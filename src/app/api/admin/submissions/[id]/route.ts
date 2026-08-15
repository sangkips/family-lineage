import { NextRequest, NextResponse } from "next/server";
import { DatePrecision, Gender, PersonStatus, Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { applyHouseholdParentage } from "@/lib/household";
import { prisma } from "@/lib/prisma";
import { assertNoCycle, CycleValidationError } from "@/lib/validation";

/**
 * POST /api/admin/submissions/[id] — approve or reject a whole submission.
 *
 * Approving takes the admin's corrected field values and their merge choices
 * in one payload, and applies the lot in a single transaction: a submission is
 * one decision, so it either lands complete or not at all.
 */

type PersonFields = {
  firstName?: string;
  lastName?: string;
  maidenName?: string | null;
  gender?: Gender | null;
  birthDate?: string | null;
  birthDatePrecision?: DatePrecision;
  birthPlace?: string | null;
  deathDate?: string | null;
  bio?: string | null;
  isLiving?: boolean;
};

type PersonDecision = {
  editId: string;
  fields?: PersonFields;
  /** Id of the person this one turned out to already be. */
  mergeInto?: string | null;
  hideBirthDate?: boolean;
  hideFullName?: boolean;
};

type Body = {
  action?: "approve" | "reject";
  people?: PersonDecision[];
  note?: string;
};

class ReviewError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

function personUpdate(fields: PersonFields | undefined): Prisma.PersonUpdateInput {
  const data: Prisma.PersonUpdateInput = {};
  if (fields?.firstName !== undefined) data.firstName = fields.firstName.trim();
  if (fields?.lastName !== undefined) data.lastName = fields.lastName.trim();
  if (fields?.maidenName !== undefined) data.maidenName = fields.maidenName?.trim() || null;
  if (fields?.gender !== undefined) data.gender = fields.gender;
  if (fields?.birthPlace !== undefined) data.birthPlace = fields.birthPlace?.trim() || null;
  if (fields?.bio !== undefined) data.bio = fields.bio?.trim() || null;
  if (fields?.isLiving !== undefined) data.isLiving = fields.isLiving;
  if (fields?.birthDatePrecision !== undefined) {
    data.birthDatePrecision = fields.birthDatePrecision;
  }

  for (const key of ["birthDate", "deathDate"] as const) {
    const value = fields?.[key];
    if (value === undefined) continue;
    if (value === null) {
      data[key] = null;
      continue;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new ReviewError(`${key} is invalid`, 400);
    }
    data[key] = parsed;
  }

  return data;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const submission = await tx.submission.findUnique({
        where: { id },
        include: { edits: true },
      });
      if (!submission) throw new ReviewError("Submission not found", 404);
      if (submission.decision) {
        throw new ReviewError("This submission has already been reviewed", 409);
      }

      const decisions = new Map(
        (body.people ?? []).map((decision) => [decision.editId, decision])
      );

      if (body.action === "reject") {
        // Proposed corrections simply evaporate; proposed people and marriages
        // are soft deleted so the audit trail survives.
        const personIds = submission.edits
          .filter((edit) => edit.requestType === "ADD_PERSON")
          .map((edit) => edit.personId)
          .filter((id): id is string => Boolean(id));
        if (personIds.length > 0) {
          await tx.person.updateMany({
            where: { id: { in: personIds } },
            data: { status: PersonStatus.REJECTED, deletedAt: new Date() },
          });
        }

        // A rejected correction just evaporates; only proposed marriages are
        // soft deleted.
        const marriageIds = submission.edits
          .filter((edit) => edit.requestType === "ADD_MARRIAGE")
          .map((edit) => edit.marriageId)
          .filter((id): id is string => Boolean(id));
        if (marriageIds.length > 0) {
          await tx.marriage.updateMany({
            where: { id: { in: marriageIds } },
            data: { status: PersonStatus.REJECTED, deletedAt: new Date() },
          });
        }
      } else {
        for (const edit of submission.edits) {
          const decision = decisions.get(edit.id);

          if (edit.requestType === "ADD_MARRIAGE" && edit.marriageId) {
            await tx.marriage.update({
              where: { id: edit.marriageId },
              data: { status: PersonStatus.APPROVED, deletedAt: null },
            });
            // The household rule: the husband becomes the father of the
            // wife's existing children. See lib/household.ts.
            await applyHouseholdParentage(tx, edit.marriageId);
            continue;
          }

          if (edit.requestType === "EDIT_MARRIAGE" && edit.marriageId) {
            // Proposed dates were parked on the edit; apply them now.
            const suggested = (edit.payload ?? {}) as {
              startDate?: string | null;
              endDate?: string | null;
              endReason?: string | null;
            };
            const data: Prisma.MarriageUpdateInput = {};
            if (suggested.startDate !== undefined) {
              data.startDate = suggested.startDate ? new Date(suggested.startDate) : null;
            }
            if (suggested.endDate !== undefined) {
              data.endDate = suggested.endDate ? new Date(suggested.endDate) : null;
            }
            if (suggested.endReason !== undefined) data.endReason = suggested.endReason;
            await tx.marriage.update({ where: { id: edit.marriageId }, data });
            continue;
          }

          if (!edit.personId) continue;

          if (edit.requestType === "EDIT_PERSON") {
            // The admin's edits win over the suggested ones.
            const suggested = (edit.payload ?? {}) as PersonFields;
            const data = {
              ...personUpdate(suggested),
              ...personUpdate(decision?.fields),
            };
            if (decision?.hideBirthDate !== undefined) {
              data.hideBirthDate = decision.hideBirthDate;
            }
            if (decision?.hideFullName !== undefined) {
              data.hideFullName = decision.hideFullName;
            }
            await tx.person.update({ where: { id: edit.personId }, data });
            continue;
          }

          if (decision?.mergeInto) {
            await mergePerson(tx, edit.id, edit.personId, decision.mergeInto);
            continue;
          }

          const data = personUpdate(decision?.fields);
          data.status = PersonStatus.APPROVED;
          data.deletedAt = null;
          if (decision?.hideBirthDate !== undefined) {
            data.hideBirthDate = decision.hideBirthDate;
          }
          if (decision?.hideFullName !== undefined) {
            data.hideFullName = decision.hideFullName;
          }
          await tx.person.update({ where: { id: edit.personId }, data });
        }
      }

      await tx.submission.update({
        where: { id },
        data: {
          decision: body.action === "approve" ? "APPROVED" : "REJECTED",
          reviewedBy: auth.userId,
          reviewedAt: new Date(),
          adminNote: body.note?.trim() || null,
        },
      });
    });

    return NextResponse.json({
      ok: true,
      decision: body.action === "approve" ? "APPROVED" : "REJECTED",
    });
  } catch (error) {
    if (error instanceof ReviewError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof CycleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("POST /api/admin/submissions/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * The submitted person turned out to be someone already in the register.
 * Re-point their links at the real person and drop the duplicate — done now,
 * while it is cheap, rather than after children and a bio hang off it.
 */
async function mergePerson(
  tx: Prisma.TransactionClient,
  editId: string,
  duplicateId: string,
  targetId: string
) {
  if (duplicateId === targetId) {
    throw new ReviewError("Cannot merge a person into themselves", 400);
  }

  const target = await tx.person.findFirst({
    where: { id: targetId, status: PersonStatus.APPROVED, deletedAt: null },
    select: { id: true },
  });
  if (!target) throw new ReviewError("The person to merge into was not found", 400);

  // Children of the duplicate become children of the target.
  const asParent = await tx.personParent.findMany({ where: { parentId: duplicateId } });
  for (const link of asParent) {
    const clash = await tx.personParent.findUnique({
      where: { childId_parentId: { childId: link.childId, parentId: targetId } },
    });
    if (clash) {
      // The child already has the real parent; the duplicate link is noise.
      await tx.personParent.delete({ where: { id: link.id } });
      continue;
    }
    // Re-pointing can close a loop that was impossible at submit time, when
    // everyone in the bundle was a fresh leaf.
    await assertNoCycle(tx, link.childId, [targetId]);
    await tx.personParent.update({
      where: { id: link.id },
      data: { parentId: targetId },
    });
  }

  // ...and the duplicate's own parents are dropped: the target already has
  // whatever parentage the register holds for them.
  await tx.personParent.deleteMany({ where: { childId: duplicateId } });

  await tx.person.update({
    where: { id: duplicateId },
    data: { status: PersonStatus.REJECTED, deletedAt: new Date() },
  });
  await tx.pendingEdit.update({
    where: { id: editId },
    data: { mergedIntoId: targetId },
  });
}
