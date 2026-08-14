import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

// ---- Public DTOs (safe to send to the browser) ----

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ParentRole = "FATHER" | "MOTHER" | "PARENT" | "GUARDIAN";

export type PersonDTO = {
  id: string;
  firstName: string;
  lastName: string;
  maidenName: string | null;
  gender: Gender | null;
  birthDate: string | null;
  deathDate: string | null;
  birthPlace: string | null;
  bio: string | null;
  isLiving: boolean;
};

export type ParentLinkDTO = {
  childId: string;
  parentId: string;
  role: ParentRole;
};

export type TreeData = {
  people: PersonDTO[];
  links: ParentLinkDTO[];
};

// ---- Row shapes returned by the raw queries ----

type PersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  maidenName: string | null;
  gender: Gender | null;
  birthDate: Date | null;
  deathDate: Date | null;
  birthPlace: string | null;
  bio: string | null;
  isLiving: boolean;
};

type LinkRow = {
  childId: string;
  parentId: string;
  role: ParentRole;
};

const PERSON_COLUMNS = `"id", "firstName", "lastName", "maidenName", "gender", "birthDate", "deathDate", "birthPlace", "bio", "isLiving"`;

/**
 * Fetch a subtree of approved people via a recursive CTE.
 *
 * - No options: starts from the root generation (people with no parents) and
 *   returns the whole tree.
 * - `rootId`: starts from a specific person (lazy-loading a branch).
 * - `depth`: limits how many generations down the recursion goes.
 *
 * People are reachable via both parents' lineages in a two-parent DAG, so the
 * CTE dedupes with `DISTINCT ON (id)` keeping the deepest occurrence. The
 * `depth` cap also guards against cycles in the data.
 */
export async function getTree(
  options: { rootId?: string; depth?: number } = {}
): Promise<TreeData> {
  const maxDepth = options.depth ?? 100;
  const rootCondition = options.rootId
    ? Prisma.sql`p."id" = ${options.rootId}`
    : Prisma.sql`NOT EXISTS (SELECT 1 FROM "PersonParent" pp WHERE pp."childId" = p."id")`;

  const peopleRows = await prisma.$queryRaw<PersonRow[]>(Prisma.sql`
    WITH RECURSIVE subtree AS (
      SELECT p.*, 0 AS depth
      FROM "Person" p
      WHERE p."status" = 'APPROVED'
        AND p."deletedAt" IS NULL
        AND ${rootCondition}
      UNION ALL
      SELECT p.*, s.depth + 1
      FROM "Person" p
      JOIN "PersonParent" pp ON pp."childId" = p."id"
      JOIN subtree s ON pp."parentId" = s."id"
      WHERE p."status" = 'APPROVED'
        AND p."deletedAt" IS NULL
        AND s.depth < ${maxDepth}
    )
    SELECT DISTINCT ON (subtree."id") ${Prisma.raw(PERSON_COLUMNS)}
    FROM subtree
    ORDER BY subtree."id", subtree.depth DESC
  `);

  const ids = peopleRows.map((p) => p.id);
  let links: ParentLinkDTO[] = [];
  if (ids.length > 0) {
    const linkRows = await prisma.$queryRaw<LinkRow[]>(Prisma.sql`
      SELECT "childId", "parentId", "role"
      FROM "PersonParent"
      WHERE "parentId" = ANY(${ids}) AND "childId" = ANY(${ids})
    `);
    links = linkRows;
  }

  const people: PersonDTO[] = peopleRows.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    maidenName: p.maidenName,
    gender: p.gender,
    birthDate: p.birthDate ? p.birthDate.toISOString() : null,
    deathDate: p.deathDate ? p.deathDate.toISOString() : null,
    birthPlace: p.birthPlace,
    bio: p.bio,
    isLiving: p.isLiving,
  }));

  return { people, links };
}
