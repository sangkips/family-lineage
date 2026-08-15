import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/submissions — everything waiting for review.
 *
 * Each submission carries its people, the parents they were entered under and
 * any look-alikes already in the tree, so the review screen can be rendered
 * (and a merge decided) without further round trips.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const submissions = await prisma.submission.findMany({
    where: {
      decision: null,
      // Skip submissions left with nothing to review after their people were
      // deleted from the database (the PendingEdit rows cascade away).
      edits: { some: {} },
    },
    include: {
      edits: {
        include: {
          person: {
            include: {
              parents: {
                include: {
                  parent: { select: { id: true, firstName: true, lastName: true } },
                },
              },
            },
          },
          marriage: {
            include: {
              partnerA: { select: { id: true, firstName: true, lastName: true } },
              partnerB: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  // Look-alikes were recorded as bare ids at submit time; fetch them once.
  const duplicateIds = [
    ...new Set(submissions.flatMap((s) => s.edits.flatMap((e) => e.duplicateIds))),
  ];
  const duplicates = duplicateIds.length
    ? await prisma.person.findMany({
        where: { id: { in: duplicateIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          birthDatePrecision: true,
          status: true,
        },
      })
    : [];
  const duplicateById = new Map(duplicates.map((d) => [d.id, d]));

  return NextResponse.json(
    submissions.map((submission) => ({
      id: submission.id,
      kind: submission.kind,
      submitterHash: submission.submitterHash,
      submittedAt: submission.submittedAt.toISOString(),
      edits: submission.edits.map((edit) => ({
        id: edit.id,
        requestType: edit.requestType,
        payload: edit.payload,
        person: edit.person
          ? {
              id: edit.person.id,
              firstName: edit.person.firstName,
              lastName: edit.person.lastName,
              maidenName: edit.person.maidenName,
              gender: edit.person.gender,
              birthDate: edit.person.birthDate?.toISOString() ?? null,
              birthDatePrecision: edit.person.birthDatePrecision,
              birthPlace: edit.person.birthPlace,
              bio: edit.person.bio,
              isLiving: edit.person.isLiving,
              hideBirthDate: edit.person.hideBirthDate,
              hideFullName: edit.person.hideFullName,
              status: edit.person.status,
            }
          : null,
        marriage: edit.marriage
          ? {
              id: edit.marriage.id,
              partnerA: `${edit.marriage.partnerA.firstName} ${edit.marriage.partnerA.lastName}`,
              partnerB: `${edit.marriage.partnerB.firstName} ${edit.marriage.partnerB.lastName}`,
              startDate: edit.marriage.startDate?.toISOString() ?? null,
              endDate: edit.marriage.endDate?.toISOString() ?? null,
              endReason: edit.marriage.endReason,
            }
          : null,
        parents: (edit.person?.parents ?? []).map((link) => ({
          id: link.parent.id,
          name: `${link.parent.firstName} ${link.parent.lastName}`,
          role: link.role,
        })),
        duplicates: edit.duplicateIds
          .map((id) => duplicateById.get(id))
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .map((d) => ({
            id: d.id,
            firstName: d.firstName,
            lastName: d.lastName,
            birthDate: d.birthDate?.toISOString() ?? null,
            birthDatePrecision: d.birthDatePrecision,
            status: d.status,
          })),
      })),
    }))
  );
}
