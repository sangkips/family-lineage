import { PersonStatus } from "@/generated/prisma/client";
import { prisma } from "./prisma";

export type FamilyMember = {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  isLiving: boolean;
};

export type FamilyGeneration = {
  /** "Children", "Grandchildren", "Great-grandchildren". */
  title: string;
  people: FamilyMember[];
};

/** Children one partner had with someone else, or with no father recorded. */
export type PartnerOnlyChildren = {
  partnerId: string;
  partnerName: string;
  people: FamilyMember[];
};

export type CoupleFamily = {
  /** Descendants of the two of them together. */
  generations: FamilyGeneration[];
  /** Children of one partner alone — shown, but never reparented. */
  otherChildren: PartnerOnlyChildren[];
};

const GENERATION_TITLES = ["Children", "Grandchildren", "Great-grandchildren"];

/**
 * Descendants of a couple, grouped by generation, three levels deep.
 *
 * Starts from the children the two partners share, then walks down. Each
 * level is one query, so the depth is bounded and a wide family costs three
 * round trips rather than one per person.
 */
export async function descendantsOfCouple(
  partnerAId: string,
  partnerBId: string
): Promise<CoupleFamily> {
  // Children of this couple: a child linked to both partners.
  const linksToPartners = await prisma.personParent.findMany({
    where: { parentId: { in: [partnerAId, partnerBId] } },
    select: { childId: true, parentId: true },
  });

  const parentCount = new Map<string, number>();
  for (const link of linksToPartners) {
    parentCount.set(link.childId, (parentCount.get(link.childId) ?? 0) + 1);
  }
  // Both partners recorded → a shared child. Only one → a child that partner
  // had elsewhere: listed further down, but never treated as the couple's,
  // because a marriage does not make someone the parent of a child they are
  // not recorded against.
  let currentIds = [...parentCount.entries()]
    .filter(([, count]) => count >= 2)
    .map(([childId]) => childId);

  const soloChildIds = [...parentCount.entries()]
    .filter(([, count]) => count === 1)
    .map(([childId]) => childId);

  const generations: FamilyGeneration[] = [];

  for (const title of GENERATION_TITLES) {
    if (currentIds.length === 0) break;

    const people = await prisma.person.findMany({
      where: { id: { in: currentIds }, status: PersonStatus.APPROVED, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        birthDatePrecision: true,
        isLiving: true,
        hideBirthDate: true,
      },
      orderBy: [{ birthDate: "asc" }, { firstName: "asc" }],
    });

    generations.push({
      title,
      people: people.map((person) => ({
        id: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        // Living people who keep their birth date private keep it private here.
        birthYear:
          person.isLiving && person.hideBirthDate
            ? null
            : (person.birthDate?.getUTCFullYear() ?? null),
        isLiving: person.isLiving,
      })),
    });

    const nextLinks = await prisma.personParent.findMany({
      where: { parentId: { in: people.map((p) => p.id) } },
      select: { childId: true },
    });
    currentIds = [...new Set(nextLinks.map((link) => link.childId))];
  }

  return {
    generations,
    otherChildren: await childrenOfEachPartnerAlone(
      [partnerAId, partnerBId],
      soloChildIds,
      linksToPartners
    ),
  };
}

/** Group the solo children under whichever partner they belong to. */
async function childrenOfEachPartnerAlone(
  partnerIds: string[],
  soloChildIds: string[],
  links: { childId: string; parentId: string }[]
): Promise<PartnerOnlyChildren[]> {
  if (soloChildIds.length === 0) return [];

  const [partners, children] = await Promise.all([
    prisma.person.findMany({
      where: { id: { in: partnerIds } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.person.findMany({
      where: {
        id: { in: soloChildIds },
        status: PersonStatus.APPROVED,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        isLiving: true,
        hideBirthDate: true,
      },
      orderBy: [{ birthDate: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const childById = new Map(children.map((child) => [child.id, child]));

  return partners
    .map((partner) => ({
      partnerId: partner.id,
      partnerName: `${partner.firstName} ${partner.lastName}`,
      people: links
        .filter((link) => link.parentId === partner.id && childById.has(link.childId))
        .map((link) => childById.get(link.childId)!)
        .map((child) => ({
          id: child.id,
          firstName: child.firstName,
          lastName: child.lastName,
          birthYear:
            child.isLiving && child.hideBirthDate
              ? null
              : (child.birthDate?.getUTCFullYear() ?? null),
          isLiving: child.isLiving,
        })),
    }))
    .filter((group) => group.people.length > 0);
}
