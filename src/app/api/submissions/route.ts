import { NextRequest, NextResponse } from "next/server";
import {
  DatePrecision,
  Gender,
  ParentRole,
  PersonStatus,
  Prisma,
} from "@/generated/prisma/client";
import { notifyAdminsOfPending } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { submitterHash } from "@/lib/submitter";
import {
  assertNoCycle,
  assertNotHanging,
  CycleValidationError,
  findPotentialDuplicates,
  HangingPersonError,
} from "@/lib/validation";

/**
 * POST /api/submissions — the public front door. No account, no login.
 *
 * Two kinds of contribution:
 *   ADD_PEOPLE   — someone plus the 1-2 parents they were entered under.
 *                  A parent is either picked from the approved tree
 *                  ({ mode: "existing" }) or typed in ({ mode: "new" }), which
 *                  is what stops a contributor being blocked when their own
 *                  parent isn't in the register yet.
 *   EDIT_PERSON  — a proposed correction to an approved person. The change is
 *                  parked on the PendingEdit and only applied on approval, so
 *                  a live ancestor is never pulled out of the public tree
 *                  while a correction waits.
 *
 * Everything lands as PENDING and is invisible to the public until an admin
 * approves the whole bundle.
 */

const MAX_PARENTS = 2;
const VALID_ROLES = new Set<string>(Object.values(ParentRole));
const VALID_GENDERS = new Set<string>(Object.values(Gender));

type ExistingParent = { mode: "existing"; parentId: string; role: ParentRole };
type NewParent = {
  mode: "new";
  firstName: string;
  lastName: string;
  birthYear?: number | null;
  gender?: Gender | null;
  role: ParentRole;
};
type ParentInput = ExistingParent | NewParent;

type PersonInput = {
  firstName?: string;
  lastName?: string;
  maidenName?: string | null;
  gender?: Gender | null;
  birthYear?: number | null;
  /** Optional exact date; when present it wins over birthYear. */
  birthDate?: string | null;
  birthPlace?: string | null;
  bio?: string | null;
};

type SubmissionBody = {
  kind?: "ADD_PEOPLE" | "EDIT_PERSON" | "ADD_MARRIAGE" | "EDIT_MARRIAGE";
  /** EDIT_MARRIAGE */
  marriageId?: string;
  marriageChanges?: {
    startYear?: number | null;
    endYear?: number | null;
    endReason?: string | null;
  };
  person?: PersonInput;
  parents?: ParentInput[];
  personId?: string;
  changes?: PersonInput & { deathDate?: string | null; isLiving?: boolean };
  /** ADD_MARRIAGE */
  partnerAId?: string;
  /** The spouse: either someone already in the register… */
  partnerBId?: string;
  /** …or someone entered by hand, for a partner who married in. */
  newPartner?: {
    firstName?: string;
    lastName?: string;
    birthYear?: number | null;
    gender?: Gender | null;
  };
  startYear?: number | null;
  endYear?: number | null;
  endReason?: string | null;
};

class BadRequest extends Error {}

/** A year on its own is stored as 1 January of that year, flagged YEAR. */
function resolveBirthDate(input: {
  birthDate?: string | null;
  birthYear?: number | null;
}): { birthDate: Date | null; precision: DatePrecision } {
  if (input.birthDate) {
    const parsed = new Date(input.birthDate);
    if (Number.isNaN(parsed.getTime())) throw new BadRequest("birthDate is invalid");
    return { birthDate: parsed, precision: DatePrecision.DAY };
  }

  if (input.birthYear !== undefined && input.birthYear !== null) {
    const year = Number(input.birthYear);
    const thisYear = new Date().getUTCFullYear();
    if (!Number.isInteger(year) || year < 1000 || year > thisYear) {
      throw new BadRequest("birthYear must be a four-digit year in the past");
    }
    return { birthDate: new Date(Date.UTC(year, 0, 1)), precision: DatePrecision.YEAR };
  }

  return { birthDate: null, precision: DatePrecision.DAY };
}

function cleanName(value: unknown, field: string): string {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name) throw new BadRequest(`${field} is required`);
  if (name.length > 80) throw new BadRequest(`${field} is too long`);
  return name;
}

function optionalText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  return text.slice(0, max);
}

function cleanGender(value: unknown): Gender | null {
  if (typeof value !== "string" || !VALID_GENDERS.has(value)) return null;
  return value as Gender;
}

export async function POST(request: NextRequest) {
  let body: SubmissionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const hash = submitterHash(request);
    if (body.kind === "EDIT_PERSON") {
      return await submitCorrection(body, hash, request);
    }
    if (body.kind === "ADD_MARRIAGE") {
      return await submitMarriage(body, hash, request);
    }
    if (body.kind === "EDIT_MARRIAGE") {
      return await submitMarriageCorrection(body, hash, request);
    }
    return await submitPeople(body, hash, request);
  } catch (error) {
    if (error instanceof BadRequest) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof HangingPersonError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof CycleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("POST /api/submissions failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---- ADD_PEOPLE ----

async function submitPeople(
  body: SubmissionBody,
  hash: string | null,
  request: NextRequest
) {
  const input = body.person ?? {};
  const firstName = cleanName(input.firstName, "First name");
  const lastName = cleanName(input.lastName, "Last name");
  const { birthDate, precision } = resolveBirthDate(input);
  if (!birthDate) throw new BadRequest("A birth year is required");

  const parents = (body.parents ?? []).slice(0, MAX_PARENTS);
  if (parents.length === 0) {
    throw new BadRequest(
      "Choose at least one parent, or enter their details if they are not in the register yet"
    );
  }

  for (const parent of parents) {
    if (!VALID_ROLES.has(parent?.role)) throw new BadRequest("Each parent needs a role");
    if (parent.mode === "existing") {
      if (!parent.parentId) throw new BadRequest("A chosen parent is missing an id");
    } else if (parent.mode === "new") {
      cleanName(parent.firstName, "Parent's first name");
      cleanName(parent.lastName, "Parent's last name");
    } else {
      throw new BadRequest("Each parent must be chosen from the tree or entered in full");
    }
  }

  // Chosen parents must be real, approved and not deleted.
  const existingIds = parents
    .filter((p): p is ExistingParent => p.mode === "existing")
    .map((p) => p.parentId);
  if (existingIds.length > 0) {
    const found = await prisma.person.findMany({
      where: { id: { in: existingIds }, status: PersonStatus.APPROVED, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== new Set(existingIds).size) {
      throw new BadRequest("One or more of the parents you chose were not found");
    }
  }

  const duplicates = await findPotentialDuplicates({ firstName, lastName, birthDate });

  const submissionId = await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: { kind: "ADD_PEOPLE", submitterHash: hash },
    });

    // Parents typed in by hand become PENDING people of their own, reviewed in
    // the same bundle. The admin may merge them into an existing person.
    const parentLinks: { parentId: string; role: ParentRole }[] = [];
    for (const parent of parents) {
      if (parent.mode === "existing") {
        parentLinks.push({ parentId: parent.parentId, role: parent.role });
        continue;
      }

      const parentFirst = cleanName(parent.firstName, "Parent's first name");
      const parentLast = cleanName(parent.lastName, "Parent's last name");
      const parentBirth = resolveBirthDate({ birthYear: parent.birthYear });
      const created = await tx.person.create({
        data: {
          firstName: parentFirst,
          lastName: parentLast,
          gender: cleanGender(parent.gender),
          birthDate: parentBirth.birthDate,
          birthDatePrecision: parentBirth.precision,
          status: PersonStatus.PENDING,
          // Safe by default: a living person's birth date stays private until
          // an admin decides otherwise.
          hideBirthDate: true,
        },
      });

      const parentDuplicates = await findPotentialDuplicates({
        firstName: parentFirst,
        lastName: parentLast,
        birthDate: parentBirth.birthDate,
      });

      await tx.pendingEdit.create({
        data: {
          personId: created.id,
          requestType: "ADD_PERSON",
          submissionId: submission.id,
          duplicateIds: parentDuplicates.map((d) => d.id),
        },
      });

      parentLinks.push({ parentId: created.id, role: parent.role });
    }

    const person = await tx.person.create({
      data: {
        firstName,
        lastName,
        maidenName: optionalText(input.maidenName, 80),
        gender: cleanGender(input.gender),
        birthDate,
        birthDatePrecision: precision,
        birthPlace: optionalText(input.birthPlace, 120),
        bio: optionalText(input.bio),
        isLiving: true,
        hideBirthDate: true,
        status: PersonStatus.PENDING,
      },
    });

    await assertNoCycle(
      tx,
      person.id,
      parentLinks.map((l) => l.parentId)
    );

    await tx.personParent.createMany({
      data: parentLinks.map((l) => ({
        childId: person.id,
        parentId: l.parentId,
        role: l.role,
      })),
    });

    await tx.pendingEdit.create({
      data: {
        personId: person.id,
        requestType: "ADD_PERSON",
        submissionId: submission.id,
        duplicateIds: duplicates.map((d) => d.id),
      },
    });

    // Nobody may enter the register connected to nobody.
    await assertNotHanging(tx, person.id);
    for (const link of parentLinks) await assertNotHanging(tx, link.parentId);

    return submission.id;
  });

  void notifyAdminsOfPending({
    personName: `${firstName} ${lastName}`,
    requestType: "ADD_PERSON",
    submittedBy: null,
    adminUrl: new URL("/admin", request.url).toString(),
  });

  // Deliberately bare: pending work is invisible to everyone but the admin,
  // so there is no id, receipt or status page to hand back.
  return NextResponse.json({ ok: true, submissionId }, { status: 201 });
}

// ---- ADD_MARRIAGE ----

/** A year on its own, as 1 January, used for wedding and end dates. */
function yearToDate(value: number | null | undefined, field: string): Date | null {
  if (value === undefined || value === null || (value as unknown) === "") return null;
  const year = Number(value);
  const thisYear = new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < 1000 || year > thisYear) {
    throw new BadRequest(`${field} must be a four-digit year in the past`);
  }
  return new Date(Date.UTC(year, 0, 1));
}

async function submitMarriage(
  body: SubmissionBody,
  hash: string | null,
  request: NextRequest
) {
  const { partnerAId, partnerBId, newPartner } = body;
  if (!partnerAId) throw new BadRequest("The first partner is required");
  if (!partnerBId && !newPartner) {
    throw new BadRequest("Choose who they married, or enter that person's details");
  }
  if (partnerBId && partnerAId === partnerBId) {
    throw new BadRequest("A person cannot be married to themselves");
  }

  const knownIds = partnerBId ? [partnerAId, partnerBId] : [partnerAId];
  const partners = await prisma.person.findMany({
    where: {
      id: { in: knownIds },
      status: PersonStatus.APPROVED,
      deletedAt: null,
    },
    select: { id: true, firstName: true, lastName: true },
  });
  if (partners.length !== knownIds.length) {
    throw new BadRequest("One of the people you chose was not found in the register");
  }

  const startDate = yearToDate(body.startYear, "Wedding year");
  const endDate = yearToDate(body.endYear, "Year it ended");
  if (startDate && endDate && endDate < startDate) {
    throw new BadRequest("A marriage cannot end before it began");
  }

  const endReason =
    body.endReason === "DIVORCE" || body.endReason === "DEATH" ? body.endReason : null;
  if (endDate && !endReason) {
    throw new BadRequest("Say whether it ended by divorce or by death");
  }

  // Validate a hand-entered spouse before opening the transaction.
  const spouseFirst = newPartner ? cleanName(newPartner.firstName, "Spouse's first name") : null;
  const spouseLast = newPartner ? cleanName(newPartner.lastName, "Spouse's last name") : null;
  const spouseBirth = newPartner ? resolveBirthDate({ birthYear: newPartner.birthYear }) : null;

  if (partnerBId) {
    const [aId, bId] = [partnerAId, partnerBId].sort();
    const existing = await prisma.marriage.findUnique({
      where: { partnerAId_partnerBId: { partnerAId: aId, partnerBId: bId } },
    });
    if (existing && !existing.deletedAt) {
      throw new BadRequest("This marriage is already recorded or awaiting review");
    }
  }

  const submissionId = await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: { kind: "ADD_MARRIAGE", submitterHash: hash },
    });

    // Someone who married in has no blood tie to this family, so they cannot
    // be entered through the "add a child" flow at all — the marriage itself
    // is what connects them, and it is created alongside them here.
    let spouseId = partnerBId ?? null;
    if (!spouseId && spouseFirst && spouseLast && spouseBirth) {
      const created = await tx.person.create({
        data: {
          firstName: spouseFirst,
          lastName: spouseLast,
          gender: cleanGender(newPartner?.gender),
          birthDate: spouseBirth.birthDate,
          birthDatePrecision: spouseBirth.precision,
          status: PersonStatus.PENDING,
          hideBirthDate: true,
        },
      });
      spouseId = created.id;

      const duplicates = await findPotentialDuplicates({
        firstName: spouseFirst,
        lastName: spouseLast,
        birthDate: spouseBirth.birthDate,
      });
      await tx.pendingEdit.create({
        data: {
          personId: created.id,
          requestType: "ADD_PERSON",
          submissionId: submission.id,
          duplicateIds: duplicates.map((d) => d.id),
        },
      });
    }

    // Sorted so the pair is unique however it was entered.
    const [aId, bId] = [partnerAId, spouseId!].sort();
    const marriage = await tx.marriage.create({
      data: {
        partnerAId: aId,
        partnerBId: bId,
        startDate,
        startPrecision: DatePrecision.YEAR,
        endDate,
        endReason,
        status: PersonStatus.PENDING,
      },
    });
    await tx.pendingEdit.create({
      data: {
        marriageId: marriage.id,
        requestType: "ADD_MARRIAGE",
        submissionId: submission.id,
      },
    });

    // The marriage counts as a connection, so a spouse who married in is not
    // treated as a stranded record.
    if (!partnerBId && spouseId) await assertNotHanging(tx, spouseId);

    return submission.id;
  });

  const names = [
    ...partners.map((p) => `${p.firstName} ${p.lastName}`),
    ...(partnerBId ? [] : [`${spouseFirst} ${spouseLast}`]),
  ].join(" & ");
  void notifyAdminsOfPending({
    personName: names,
    requestType: "ADD_MARRIAGE",
    submittedBy: null,
    adminUrl: new URL("/admin", request.url).toString(),
  });

  return NextResponse.json({ ok: true, submissionId }, { status: 201 });
}

// ---- EDIT_MARRIAGE ----

/**
 * Correct a marriage already in the register — the wedding year, or when and
 * how it ended. Like a person correction, the change waits on the PendingEdit
 * and the live marriage is untouched until an admin approves it.
 *
 * The partners themselves are not editable here: changing who married whom is
 * a different marriage, and should be recorded as one.
 */
async function submitMarriageCorrection(
  body: SubmissionBody,
  hash: string | null,
  request: NextRequest
) {
  const { marriageId } = body;
  if (!marriageId) throw new BadRequest("marriageId is required");

  const marriage = await prisma.marriage.findFirst({
    where: { id: marriageId, status: PersonStatus.APPROVED, deletedAt: null },
    include: {
      partnerA: { select: { firstName: true, lastName: true } },
      partnerB: { select: { firstName: true, lastName: true } },
    },
  });
  if (!marriage) {
    return NextResponse.json({ error: "That marriage was not found" }, { status: 404 });
  }

  const changes = body.marriageChanges ?? {};
  const payload: Prisma.JsonObject = {};

  if (changes.startYear !== undefined) {
    const startDate = yearToDate(changes.startYear, "Wedding year");
    payload.startDate = startDate ? startDate.toISOString() : null;
  }
  if (changes.endYear !== undefined) {
    const endDate = yearToDate(changes.endYear, "Year it ended");
    payload.endDate = endDate ? endDate.toISOString() : null;
  }
  if (changes.endReason !== undefined) {
    payload.endReason =
      changes.endReason === "DIVORCE" || changes.endReason === "DEATH"
        ? changes.endReason
        : null;
  }

  if (Object.keys(payload).length === 0) {
    throw new BadRequest("No changes were suggested");
  }

  // Compare against what the marriage would become, not just what was sent.
  const nextStart =
    payload.startDate !== undefined
      ? (payload.startDate as string | null)
      : (marriage.startDate?.toISOString() ?? null);
  const nextEnd =
    payload.endDate !== undefined
      ? (payload.endDate as string | null)
      : (marriage.endDate?.toISOString() ?? null);
  if (nextStart && nextEnd && new Date(nextEnd) < new Date(nextStart)) {
    throw new BadRequest("A marriage cannot end before it began");
  }
  if (nextEnd && payload.endReason === null) {
    throw new BadRequest("Say whether it ended by divorce or by death");
  }

  const submissionId = await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: { kind: "EDIT_MARRIAGE", submitterHash: hash },
    });
    await tx.pendingEdit.create({
      data: {
        marriageId: marriage.id,
        requestType: "EDIT_MARRIAGE",
        submissionId: submission.id,
        payload,
      },
    });
    return submission.id;
  });

  void notifyAdminsOfPending({
    personName: `${marriage.partnerA.firstName} ${marriage.partnerA.lastName} & ${marriage.partnerB.firstName} ${marriage.partnerB.lastName}`,
    requestType: "EDIT_MARRIAGE",
    submittedBy: null,
    adminUrl: new URL("/admin", request.url).toString(),
  });

  return NextResponse.json({ ok: true, submissionId }, { status: 201 });
}

// ---- EDIT_PERSON ----

async function submitCorrection(
  body: SubmissionBody,
  hash: string | null,
  request: NextRequest
) {
  const personId = body.personId;
  if (!personId) throw new BadRequest("personId is required");

  const person = await prisma.person.findFirst({
    where: { id: personId, status: PersonStatus.APPROVED, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!person) {
    return NextResponse.json({ error: "That person was not found" }, { status: 404 });
  }

  const changes = body.changes ?? {};
  const payload: Prisma.JsonObject = {};

  if (changes.firstName !== undefined) {
    payload.firstName = cleanName(changes.firstName, "First name");
  }
  if (changes.lastName !== undefined) {
    payload.lastName = cleanName(changes.lastName, "Last name");
  }
  if (changes.maidenName !== undefined) {
    payload.maidenName = optionalText(changes.maidenName, 80);
  }
  if (changes.gender !== undefined) payload.gender = cleanGender(changes.gender);
  if (changes.birthPlace !== undefined) {
    payload.birthPlace = optionalText(changes.birthPlace, 120);
  }
  if (changes.bio !== undefined) payload.bio = optionalText(changes.bio);
  if (changes.isLiving !== undefined) payload.isLiving = Boolean(changes.isLiving);
  if (changes.deathDate !== undefined) {
    if (changes.deathDate === null) {
      payload.deathDate = null;
    } else {
      const parsed = new Date(changes.deathDate);
      if (Number.isNaN(parsed.getTime())) throw new BadRequest("deathDate is invalid");
      payload.deathDate = parsed.toISOString();
    }
  }
  if (changes.birthDate !== undefined || changes.birthYear !== undefined) {
    const resolved = resolveBirthDate(changes);
    payload.birthDate = resolved.birthDate ? resolved.birthDate.toISOString() : null;
    payload.birthDatePrecision = resolved.precision;
  }

  if (Object.keys(payload).length === 0) {
    throw new BadRequest("No changes were suggested");
  }

  const submissionId = await prisma.$transaction(async (tx) => {
    const submission = await tx.submission.create({
      data: { kind: "EDIT_PERSON", submitterHash: hash },
    });
    await tx.pendingEdit.create({
      data: {
        personId: person.id,
        requestType: "EDIT_PERSON",
        submissionId: submission.id,
        payload,
      },
    });
    return submission.id;
  });

  void notifyAdminsOfPending({
    personName: `${person.firstName} ${person.lastName}`,
    requestType: "EDIT_PERSON",
    submittedBy: null,
    adminUrl: new URL("/admin", request.url).toString(),
  });

  return NextResponse.json({ ok: true, submissionId }, { status: 201 });
}
