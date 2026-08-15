import { Prisma, UserRole } from "@/generated/prisma/client";
import { withDbRetry } from "./db-retry";
import { prisma } from "./prisma";
import { getOrCreateProfile, type AuthUser } from "./profile";

// ---- Public DTOs (safe to send to the browser) ----

export type Gender = "MALE" | "FEMALE" | "OTHER";
export type ParentRole = "FATHER" | "MOTHER" | "PARENT" | "GUARDIAN";
export type DatePrecision = "YEAR" | "MONTH" | "DAY";

export type PersonStatusDTO = "PENDING" | "APPROVED";

export type PersonDTO = {
  id: string;
  firstName: string;
  lastName: string;
  maidenName: string | null;
  gender: Gender | null;
  birthDate: string | null;
  /** How much of `birthDate` was actually known — "1948" vs "12 April 1948". */
  birthDatePrecision: DatePrecision;
  deathDate: string | null;
  birthPlace: string | null;
  bio: string | null;
  isLiving: boolean;
  /** APPROVED entries are public; PENDING ones only render for admins. */
  status: PersonStatusDTO;
};

export type ParentLinkDTO = {
  childId: string;
  parentId: string;
  role: ParentRole;
};

export type MarriageDTO = {
  id: string;
  partnerAId: string;
  partnerBId: string;
  startDate: string | null;
  startPrecision: DatePrecision;
  endDate: string | null;
  endReason: string | null;
};

export type TreeData = {
  people: PersonDTO[];
  links: ParentLinkDTO[];
  /** Recorded marriages. Couples not listed here may still be paired by the
   *  layout from sharing a child — that pairing is a guess, this is a record. */
  marriages: MarriageDTO[];
};

// ---- Row shapes returned by the raw queries ----

type PersonRow = {
  id: string;
  firstName: string;
  lastName: string;
  maidenName: string | null;
  gender: Gender | null;
  birthDate: Date | null;
  birthDatePrecision: DatePrecision;
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

const PERSON_COLUMNS = `"id", "firstName", "lastName", "maidenName", "gender", "birthDate", "birthDatePrecision", "deathDate", "birthPlace", "bio", "isLiving", "hideBirthDate", "hideFullName", "status"`;

/**
 * Who is looking at the tree. Contributors are anonymous, so there are only
 * two audiences: the admin, who sees pending entries awaiting review, and
 * everyone else, who sees the approved register.
 */
export type TreeViewer = { isAdmin: boolean } | null;

/** Resolve what a signed-in user is allowed to see in the tree. */
export async function resolveViewer(user: AuthUser): Promise<TreeViewer> {
  const profile = await getOrCreateProfile(user);
  return { isAdmin: profile.role === UserRole.ADMIN };
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
  const isAdminViewer = options.viewer?.isAdmin === true;
  const rootCondition = options.rootId
    ? Prisma.sql`p."id" = ${options.rootId}`
    : Prisma.sql`NOT EXISTS (SELECT 1 FROM "PersonParent" pp WHERE pp."childId" = p."id")`;

  const pendingClause = isAdminViewer ? Prisma.sql`TRUE` : Prisma.sql`FALSE`;

  const visible = Prisma.sql`(
    p."status" = 'APPROVED'
    OR (p."status" = 'PENDING' AND ${pendingClause})
  ) AND p."deletedAt" IS NULL`;

  // Retried once on a transient network failure: mobile connections drop and
  // DNS occasionally stalls, and neither should take the whole tree down.
  const peopleRows = await withDbRetry(() =>
    prisma.$queryRaw<PersonRow[]>(Prisma.sql`
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
  `)
  );

  const ids = peopleRows.map((p) => p.id);
  let links: ParentLinkDTO[] = [];
  let marriages: MarriageDTO[] = [];
  if (ids.length > 0) {
    // Both depend only on the person ids, so they go out together — the
    // database is a long way away and each sequential round trip is felt.
    const [linkRows, marriageRows] = await withDbRetry(() =>
      Promise.all([
        prisma.$queryRaw<LinkRow[]>(Prisma.sql`
          SELECT "childId", "parentId", "role"
          FROM "PersonParent"
          WHERE "parentId" = ANY(${ids}) AND "childId" = ANY(${ids})
        `),
        prisma.marriage.findMany({
          where: {
            deletedAt: null,
            partnerAId: { in: ids },
            partnerBId: { in: ids },
            // Pending marriages, like pending people, are for the admin's eyes.
            ...(isAdminViewer ? {} : { status: "APPROVED" }),
          },
        }),
      ])
    );
    links = linkRows;
    marriages = marriageRows.map((m) => ({
      id: m.id,
      partnerAId: m.partnerAId,
      partnerBId: m.partnerBId,
      startDate: m.startDate?.toISOString() ?? null,
      startPrecision: m.startPrecision,
      endDate: m.endDate?.toISOString() ?? null,
      endReason: m.endReason,
    }));
  }

  // Privacy: living members who opt out of sharing birth details or their
  // full name are redacted for everyone except admins and themselves.
  const isAdmin = isAdminViewer;
  const people: PersonDTO[] = peopleRows.map((p) => {
    // Privacy toggles only apply while the person is living — deceased
    // relatives' records are historical and always public.
    const canSeeFull = !p.isLiving || isAdmin;
    const hideBirth = !canSeeFull && p.hideBirthDate;
    const hideName = !canSeeFull && p.hideFullName;

    return {
      id: p.id,
      firstName: hideName ? "Private" : p.firstName,
      lastName: hideName ? "" : p.lastName,
      maidenName: hideName ? null : p.maidenName,
      gender: p.gender,
      birthDate: hideBirth ? null : p.birthDate ? p.birthDate.toISOString() : null,
      birthDatePrecision: p.birthDatePrecision,
      deathDate: p.deathDate ? p.deathDate.toISOString() : null,
      birthPlace: hideBirth ? null : p.birthPlace,
      bio: p.bio,
      isLiving: p.isLiving,
      status: p.status,
    };
  });

  return { people, links, marriages };
}
