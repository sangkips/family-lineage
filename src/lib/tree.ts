import { Prisma, UserRole } from "@/generated/prisma/client";
import { prisma } from "./prisma";

// ---- Public DTOs (safe to send to the browser) ----

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ParentRole = "FATHER" | "MOTHER" | "PARENT" | "GUARDIAN";

export type PersonStatusDTO = "PENDING" | "APPROVED";

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
  /** APPROVED entries are public; PENDING ones only render for their submitter / admins. */
  status: PersonStatusDTO;
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
  /** Living members can opt out of sharing these with non-admin visitors. */
  hideBirthDate: boolean;
  hideFullName: boolean;
  status: PersonStatusDTO;
};

type LinkRow = {
  childId: string;
  parentId: string;
  role: ParentRole;
};

const PERSON_COLUMNS = `"id", "firstName", "lastName", "maidenName", "gender", "birthDate", "deathDate", "birthPlace", "bio", "isLiving", "hideBirthDate", "hideFullName", "status"`;

/**
 * Who is looking at the tree. Controls whether PENDING people (ghost nodes)
 * are included: a signed-in member sees their own submissions, an admin sees
 * all of them, and anonymous visitors see approved entries only.
 */
export type TreeViewer = {
  userId: string;
  isAdmin: boolean;
  /** The Person node this account claimed, if any (null before claiming). */
  personId: string | null;
} | null;

/** Resolve what a signed-in user is allowed to see in the tree. */
export async function resolveViewer(userId: string): Promise<TreeViewer> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { role: true, personId: true },
  });
  return {
    userId,
    isAdmin: profile?.role === UserRole.ADMIN,
    personId: profile?.personId ?? null,
  };
}

/**
 * Fetch a subtree via a recursive CTE.
 *
 * - No options: starts from the root generation (people with no parents) and
 *   returns the whole tree.
 * - `rootId`: starts from a specific person (lazy-loading a branch).
 * - `depth`: limits how many generations down the recursion goes.
 * - `viewer`: include PENDING ghost nodes the viewer is allowed to see.
 *
 * People are reachable via both parents' lineages in a two-parent DAG, so the
 * CTE dedupes with `DISTINCT ON (id)` keeping the deepest occurrence. The
 * `depth` cap also guards against cycles in the data.
 */
export async function getTree(
  options: { rootId?: string; depth?: number; viewer?: TreeViewer } = {}
): Promise<TreeData> {
  const maxDepth = options.depth ?? 100;
  const rootCondition = options.rootId
    ? Prisma.sql`p."id" = ${options.rootId}`
    : Prisma.sql`NOT EXISTS (SELECT 1 FROM "PersonParent" pp WHERE pp."childId" = p."id")`;

  const pendingClause = options.viewer
    ? options.viewer.isAdmin
      ? Prisma.sql`TRUE`
      : Prisma.sql`p."createdBy" = ${options.viewer.userId}`
    : Prisma.sql`FALSE`;

  const visible = Prisma.sql`(
    p."status" = 'APPROVED'
    OR (p."status" = 'PENDING' AND ${pendingClause})
  ) AND p."deletedAt" IS NULL`;

  const peopleRows = await prisma.$queryRaw<PersonRow[]>(Prisma.sql`
    WITH RECURSIVE subtree AS (
      SELECT p.*, 0 AS depth
      FROM "Person" p
      WHERE ${visible}
        AND ${rootCondition}
      UNION ALL
      SELECT p.*, s.depth + 1
      FROM "Person" p
      JOIN "PersonParent" pp ON pp."childId" = p."id"
      JOIN subtree s ON pp."parentId" = s."id"
      WHERE ${visible}
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

  // Privacy: living members who opt out of sharing birth details or their
  // full name are redacted for everyone except admins and themselves.
  const viewer = options.viewer;
  const people: PersonDTO[] = peopleRows.map((p) => {
    const isSelf = viewer?.personId === p.id;
    const isAdmin = viewer?.isAdmin === true;
    // Privacy toggles only apply while the person is living — deceased
    // relatives' records are historical and always public.
    const canSeeFull = !p.isLiving || isSelf || isAdmin;
    const hideBirth = !canSeeFull && p.hideBirthDate;
    const hideName = !canSeeFull && p.hideFullName;

    return {
      id: p.id,
      firstName: hideName ? "Private" : p.firstName,
      lastName: hideName ? "" : p.lastName,
      maidenName: hideName ? null : p.maidenName,
      gender: p.gender,
      birthDate: hideBirth ? null : p.birthDate ? p.birthDate.toISOString() : null,
      deathDate: p.deathDate ? p.deathDate.toISOString() : null,
      birthPlace: hideBirth ? null : p.birthPlace,
      bio: p.bio,
      isLiving: p.isLiving,
      status: p.status,
    };
  });

  return { people, links };
}
