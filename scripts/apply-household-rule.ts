import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, PersonStatus } from "../src/generated/prisma/client";
import { applyHouseholdParentage } from "../src/lib/household";

/**
 * One-off: apply the household rule to marriages already in the register.
 *
 * The husband becomes the father of his wife's existing children. Each wife
 * keeps only her own. Marriages recorded from now on get this automatically
 * at approval; this brings the existing ones in line.
 *
 * Run `npx tsx scripts/apply-household-rule.ts` to see what would change,
 * and `... --write` to apply it.
 */
async function main() {
  const write = process.argv.includes("--write");
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  const marriages = await prisma.marriage.findMany({
    where: { status: PersonStatus.APPROVED, deletedAt: null },
    include: {
      partnerA: { select: { firstName: true, lastName: true, gender: true } },
      partnerB: { select: { firstName: true, lastName: true, gender: true } },
    },
  });

  console.log(`${marriages.length} approved marriages\n`);
  let totalLinked = 0;

  for (const marriage of marriages) {
    const label = `${marriage.partnerA.firstName} ${marriage.partnerA.lastName} & ${marriage.partnerB.firstName} ${marriage.partnerB.lastName}`;

    // The dry run and the real run share one code path: the transaction is
    // rolled back unless --write was passed.
    try {
      const result = await prisma.$transaction(async (tx) => {
        const outcome = await applyHouseholdParentage(tx, marriage.id);
        if (!write) throw new DryRun(outcome.linked, outcome.skipped);
        return outcome;
      });
      if (result.linked.length > 0) {
        totalLinked += result.linked.length;
        console.log(`  ${label}: linked ${result.linked.length} child(ren)`);
      } else {
        console.log(`  ${label}: nothing to do (${result.skipped ?? "already linked"})`);
      }
    } catch (error) {
      if (error instanceof DryRun) {
        if (error.linked.length > 0) {
          totalLinked += error.linked.length;
          const names = await prisma.person.findMany({
            where: { id: { in: error.linked } },
            select: { firstName: true, lastName: true },
          });
          console.log(
            `  ${label}: WOULD link ${names.map((n) => `${n.firstName} ${n.lastName}`).join(", ")}`
          );
        } else {
          console.log(`  ${label}: nothing to do (${error.skipped ?? "already linked"})`);
        }
        continue;
      }
      throw error;
    }
  }

  console.log(
    `\n${write ? "linked" : "would link"} ${totalLinked} child(ren) in total` +
      (write ? "" : "\nRe-run with --write to apply.")
  );
  await prisma.$disconnect();
}

/** Thrown to roll back the transaction during a dry run. */
class DryRun extends Error {
  constructor(
    readonly linked: string[],
    readonly skipped?: string
  ) {
    super("dry run");
  }
}

main();
