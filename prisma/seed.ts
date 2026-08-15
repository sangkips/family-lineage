import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  DatePrecision,
  Gender,
  ParentRole,
  PersonStatus,
} from "../src/generated/prisma/client";

// Demo data: a 7-generation family (gen 0 = great-great-grandparents down to
// gen 6 = great-grandchildren). Exercises the edge cases from PLAN.md:
//   - single known parent (unknown father/mother)
//   - multiple children per couple
//   - a sibling branch (Esther → Paul → Kevin)

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const people: Record<string, string> = {};

type PersonInput = {
  firstName: string;
  lastName: string;
  maidenName?: string;
  gender: Gender;
  birthDate?: Date;
  deathDate?: Date;
  birthPlace?: string;
  isLiving?: boolean;
  bio?: string;
};

async function add(key: string, input: PersonInput) {
  const person = await prisma.person.create({
    data: {
      ...input,
      status: PersonStatus.APPROVED,
    },
  });
  people[key] = person.id;
}

async function link(childKey: string, parentKey: string, role: ParentRole) {
  await prisma.personParent.create({
    data: {
      childId: people[childKey],
      parentId: people[parentKey],
      role,
    },
  });
}

/**
 * Record a marriage. Partner ids are stored sorted, matching the unique
 * constraint, so the same couple cannot be entered twice in either order.
 */
async function marry(
  aKey: string,
  bKey: string,
  startYear: number,
  end?: { year: number; reason: "DEATH" | "DIVORCE" }
) {
  const [partnerAId, partnerBId] = [people[aKey], people[bKey]].sort();
  await prisma.marriage.create({
    data: {
      partnerAId,
      partnerBId,
      startDate: new Date(Date.UTC(startYear, 0, 1)),
      startPrecision: DatePrecision.YEAR,
      endDate: end ? new Date(Date.UTC(end.year, 0, 1)) : null,
      endReason: end?.reason ?? null,
      status: PersonStatus.APPROVED,
    },
  });
}

async function main() {
  console.log("Clearing existing data…");
  await prisma.pendingEdit.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.marriage.deleteMany();
  await prisma.personParent.deleteMany();
  await prisma.person.deleteMany();

  // ---- Generation 0: great-great-grandparents ----
  await add("joseph", {
    firstName: "Joseph", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("1890-04-12"), deathDate: new Date("1975-11-03"),
    birthPlace: "County Cork, Ireland", isLiving: false,
    bio: "The family's great-great-grandfather. Emigrated to the US in 1910.",
  });
  await add("maria", {
    firstName: "Maria", lastName: "Anderson", maidenName: "Fitzgerald", gender: Gender.FEMALE,
    birthDate: new Date("1893-08-25"), deathDate: new Date("1980-02-14"),
    birthPlace: "County Cork, Ireland", isLiving: false,
  });

  // ---- Generation 1: great-grandparents ----
  await add("david", {
    firstName: "David", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("1915-03-02"), deathDate: new Date("1990-06-21"),
    birthPlace: "Boston, MA", isLiving: false,
  });
  await add("rachel", {
    firstName: "Rachel", lastName: "Anderson", maidenName: "Goldberg", gender: Gender.FEMALE,
    birthDate: new Date("1918-11-17"), deathDate: new Date("1995-09-09"),
    birthPlace: "New York, NY", isLiving: false,
  });

  // ---- Generation 2: grandparents ----
  await add("samuel", {
    firstName: "Samuel", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("1940-01-30"), deathDate: new Date("2010-12-05"),
    birthPlace: "Boston, MA", isLiving: false,
  });
  await add("grace", {
    firstName: "Grace", lastName: "Anderson", maidenName: "Nguyen", gender: Gender.FEMALE,
    birthDate: new Date("1943-07-19"), deathDate: new Date("2015-04-27"),
    birthPlace: "San Francisco, CA", isLiving: false,
  });
  await add("esther", {
    firstName: "Esther", lastName: "Anderson", gender: Gender.FEMALE,
    birthDate: new Date("1945-05-06"), birthPlace: "Boston, MA", isLiving: true,
  });

  // ---- Generation 3: parents ----
  await add("daniel", {
    firstName: "Daniel", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("1968-09-14"), birthPlace: "Chicago, IL", isLiving: true,
  });
  await add("sarah", {
    firstName: "Sarah", lastName: "Anderson", maidenName: "Chen", gender: Gender.FEMALE,
    birthDate: new Date("1971-02-28"), birthPlace: "Seattle, WA", isLiving: true,
  });
  await add("ruth", {
    firstName: "Ruth", lastName: "Anderson", gender: Gender.FEMALE,
    birthDate: new Date("1970-06-11"), birthPlace: "Chicago, IL", isLiving: true,
  });
  await add("paul", {
    firstName: "Paul", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("1972-10-03"), birthPlace: "Chicago, IL", isLiving: true,
  });

  // ---- Generation 4: children ("you" generation) ----
  await add("michael", {
    firstName: "Michael", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("1995-04-22"), birthPlace: "Chicago, IL", isLiving: true,
    bio: "A good person to anchor the tree on — has parents, a spouse and children in every direction.",
  });
  await add("jessica", {
    firstName: "Jessica", lastName: "Anderson", gender: Gender.FEMALE,
    birthDate: new Date("1998-12-01"), birthPlace: "Chicago, IL", isLiving: true,
  });
  await add("kevin", {
    firstName: "Kevin", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("1996-08-15"), birthPlace: "Austin, TX", isLiving: true,
  });
  await add("hannah", {
    firstName: "Hannah", lastName: "Anderson", maidenName: "Patel", gender: Gender.FEMALE,
    birthDate: new Date("1997-03-09"), birthPlace: "Denver, CO", isLiving: true,
  });

  // ---- Generation 5: grandchildren ----
  await add("ethan", {
    firstName: "Ethan", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("2020-05-18"), birthPlace: "Chicago, IL", isLiving: true,
  });
  await add("mia", {
    firstName: "Mia", lastName: "Anderson", gender: Gender.FEMALE,
    birthDate: new Date("2022-09-30"), birthPlace: "Chicago, IL", isLiving: true,
  });

  // ---- Generation 6: great-grandchildren ----
  await add("noah", {
    firstName: "Noah", lastName: "Anderson", gender: Gender.MALE,
    birthDate: new Date("2043-01-25"), birthPlace: "Chicago, IL", isLiving: true,
  });

  // ---- Parent links (father / mother) ----
  await link("david", "joseph", ParentRole.FATHER);
  await link("david", "maria", ParentRole.MOTHER);
  await link("samuel", "david", ParentRole.FATHER);
  await link("samuel", "rachel", ParentRole.MOTHER);
  await link("esther", "david", ParentRole.FATHER);
  await link("esther", "rachel", ParentRole.MOTHER);
  await link("daniel", "samuel", ParentRole.FATHER);
  await link("daniel", "grace", ParentRole.MOTHER);
  await link("ruth", "samuel", ParentRole.FATHER);
  await link("ruth", "grace", ParentRole.MOTHER);
  await link("paul", "esther", ParentRole.MOTHER); // unknown father — single-parent node
  await link("michael", "daniel", ParentRole.FATHER);
  await link("michael", "sarah", ParentRole.MOTHER);
  await link("jessica", "daniel", ParentRole.FATHER);
  await link("jessica", "sarah", ParentRole.MOTHER);
  await link("kevin", "paul", ParentRole.FATHER);
  await link("ethan", "michael", ParentRole.FATHER);
  await link("ethan", "hannah", ParentRole.MOTHER);
  await link("mia", "michael", ParentRole.FATHER);
  await link("mia", "hannah", ParentRole.MOTHER);
  await link("noah", "ethan", ParentRole.FATHER); // unknown mother — single-parent node

  // ---- Marriages ----
  // Recorded explicitly rather than guessed from shared children, so a couple
  // is a fact in the register. Esther, Paul and Ethan stay unmarried: their
  // partners are genuinely unknown.
  await marry("joseph", "maria", 1912, { year: 1975, reason: "DEATH" });
  await marry("david", "rachel", 1938, { year: 1990, reason: "DEATH" });
  await marry("samuel", "grace", 1965, { year: 2010, reason: "DEATH" });
  await marry("daniel", "sarah", 1993);
  await marry("michael", "hannah", 2018);

  const [peopleCount, marriageCount] = await Promise.all([
    prisma.person.count(),
    prisma.marriage.count(),
  ]);
  console.log(
    `✅ Seeded ${peopleCount} people and ${marriageCount} marriages across 7 generations.`
  );
  console.log("Great-great-grandparents: Joseph & Maria Anderson (married 1912)");
  console.log("Gen 6 (great-grandchildren): Noah Anderson");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
