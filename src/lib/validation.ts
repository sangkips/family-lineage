import { Prisma, type PersonStatus } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/**
 * Shared write-endpoint validation (PLAN.md §6): duplicate detection and
 * cycle prevention.
 */

// ---- Duplicate detection ----

export type DuplicateMatch = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: Date | null;
  status: PersonStatus;
};

/**
 * Find existing (non-deleted) people who look like a duplicate of a new
 * submission: same first + last name (case-insensitive) and, when a birth
 * date is provided, the same birth date. Used to warn the submitter rather
 * than block — the final call stays with the admin in the moderation queue.
 */
export async function findPotentialDuplicates(input: {
  firstName: string;
  lastName: string;
  birthDate?: Date | null;
}): Promise<DuplicateMatch[]> {
  const where: Prisma.PersonWhereInput = {
    deletedAt: null,
    firstName: { equals: input.firstName, mode: "insensitive" },
    lastName: { equals: input.lastName, mode: "insensitive" },
  };
  // Only require a birth-date match when one was actually submitted, so
  // people with unknown birth dates aren't falsely flagged as duplicates.
  if (input.birthDate) {
    where.birthDate = input.birthDate;
  }

  return prisma.person.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
    take: 10,
  });
}

// ---- Hanging people ----

export class HangingPersonError extends Error {
  constructor() {
    super(
      "Everyone must be connected to at least one relative — add them as someone's child, or as the parent of someone already in the tree."
    );
    this.name = "HangingPersonError";
  }
}

/**
 * Would this person be left connected to nobody?
 *
 * Someone with no link in either direction is not part of a lineage tree —
 * they render as a card stranded beside it. The single exception is the very
 * first person saved into an empty tree, who has nobody to link to yet;
 * their spouse arrives later as the co-parent of their first child.
 *
 * Kept as a pure function so the rule can be tested without a database.
 */
export function isHangingPerson(linkCount: number, otherPeopleCount: number): boolean {
  if (linkCount > 0) return false;
  return otherPeopleCount > 0;
}

/** Guard for transaction callbacks: throws if `personId` ends up unlinked. */
export async function assertNotHanging(
  client: CycleClient,
  personId: string
): Promise<void> {
  const [linkCount, otherPeopleCount] = await Promise.all([
    client.personParent.count({
      where: { OR: [{ childId: personId }, { parentId: personId }] },
    }),
    client.person.count({ where: { id: { not: personId }, deletedAt: null } }),
  ]);

  if (isHangingPerson(linkCount, otherPeopleCount)) {
    throw new HangingPersonError();
  }
}

// ---- Cycle prevention ----

export class CycleValidationError extends Error {
  constructor() {
    super("This link would make a person their own ancestor");
    this.name = "CycleValidationError";
  }
}

type CycleClient = Prisma.TransactionClient | typeof prisma;

/**
 * Would adding `parentId` as a parent of `childId` create a cycle?
 *
 * The tree is a directed acyclic graph: a person can never be their own
 * ancestor. Adding parent→child creates a cycle iff `childId` is already an
 * ancestor of `parentId`. Checked with a recursive CTE walking upward from
 * the prospective parent.
 */
export async function wouldCreateCycle(
  client: CycleClient,
  childId: string,
  parentId: string
): Promise<boolean> {
  if (childId === parentId) return true;

  const rows = await client.$queryRaw<{ cycle: boolean }[]>(Prisma.sql`
    WITH RECURSIVE ancestors AS (
      SELECT pp."parentId"
      FROM "PersonParent" pp
      WHERE pp."childId" = ${parentId}
      UNION
      SELECT pp."parentId"
      FROM "PersonParent" pp
      JOIN ancestors a ON pp."childId" = a."parentId"
    )
    SELECT EXISTS (
      SELECT 1 FROM ancestors WHERE "parentId" = ${childId}
    ) AS cycle
  `);

  return rows[0]?.cycle ?? false;
}

/**
 * Guard helper for transaction callbacks: throws `CycleValidationError` if
 * any of the prospective parent links would create a cycle.
 */
export async function assertNoCycle(
  client: CycleClient,
  childId: string,
  parentIds: string[]
): Promise<void> {
  for (const parentId of parentIds) {
    if (await wouldCreateCycle(client, childId, parentId)) {
      throw new CycleValidationError();
    }
  }
}
