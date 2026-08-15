import { Gender, ParentRole, PersonStatus, type Prisma } from "@/generated/prisma/client";
import { wouldCreateCycle } from "./validation";

/**
 * Household parentage.
 *
 * This register records the family as it is lived, not as biology: once a
 * marriage is recorded, the husband is the father of every child in the
 * household, including children his wife already had. Each wife keeps only
 * her own children — a man's children from an earlier marriage do not become
 * his new wife's.
 *
 * So the rule is one-directional: link the husband to the wife's children,
 * never the reverse.
 */

type Client = Prisma.TransactionClient;

export type HouseholdResult = {
  /** Children who gained the husband as a parent. */
  linked: string[];
  /** Why nothing happened, when nothing did. */
  skipped?: "no-husband" | "no-wife" | "no-children";
};

/**
 * Apply the rule to one marriage. Safe to run repeatedly: links that already
 * exist are left alone.
 */
export async function applyHouseholdParentage(
  tx: Client,
  marriageId: string
): Promise<HouseholdResult> {
  const marriage = await tx.marriage.findUnique({
    where: { id: marriageId },
    include: {
      partnerA: { select: { id: true, gender: true } },
      partnerB: { select: { id: true, gender: true } },
    },
  });
  if (!marriage) return { linked: [], skipped: "no-husband" };

  const partners = [marriage.partnerA, marriage.partnerB];
  const husband = partners.find((p) => p.gender === Gender.MALE);
  const wife = partners.find((p) => p.gender === Gender.FEMALE);

  // Without a recorded man and woman there is no "father takes the children"
  // to apply, and guessing would invent parentage. Leave it to a human.
  if (!husband) return { linked: [], skipped: "no-husband" };
  if (!wife) return { linked: [], skipped: "no-wife" };

  const wifeChildren = await tx.personParent.findMany({
    where: { parentId: wife.id, child: { deletedAt: null } },
    select: { childId: true },
  });
  if (wifeChildren.length === 0) return { linked: [], skipped: "no-children" };

  const alreadyHis = await tx.personParent.findMany({
    where: {
      parentId: husband.id,
      childId: { in: wifeChildren.map((c) => c.childId) },
    },
    select: { childId: true },
  });
  const has = new Set(alreadyHis.map((c) => c.childId));

  const linked: string[] = [];
  for (const { childId } of wifeChildren) {
    if (has.has(childId)) continue;
    // A child cannot become the parent of their own parent.
    if (await wouldCreateCycle(tx, childId, husband.id)) continue;

    await tx.personParent.create({
      data: { childId, parentId: husband.id, role: ParentRole.FATHER },
    });
    linked.push(childId);
  }

  return { linked };
}

/**
 * The other half of the rule: a child added to a household belongs to both
 * partners of that marriage. Returns the spouse to record alongside a parent,
 * so the person entering a child never has to search for the second one.
 */
export async function spousesOf(
  client: Client | typeof import("./prisma").prisma,
  personId: string
): Promise<{ id: string; firstName: string; lastName: string; gender: Gender | null }[]> {
  const marriages = await client.marriage.findMany({
    where: {
      status: PersonStatus.APPROVED,
      deletedAt: null,
      OR: [{ partnerAId: personId }, { partnerBId: personId }],
    },
    include: {
      partnerA: { select: { id: true, firstName: true, lastName: true, gender: true } },
      partnerB: { select: { id: true, firstName: true, lastName: true, gender: true } },
    },
    orderBy: { startDate: "desc" },
  });

  return marriages.map((marriage) =>
    marriage.partnerAId === personId ? marriage.partnerB : marriage.partnerA
  );
}
