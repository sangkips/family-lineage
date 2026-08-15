import Link from "next/link";
import { notFound } from "next/navigation";
import MarriageForm from "@/components/submit/MarriageForm";
import { PersonStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** /marry/[id] — public "record a marriage" for a person. No sign-in. */
export default async function MarryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const person = await prisma.person.findFirst({
    where: { id, status: PersonStatus.APPROVED, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!person) notFound();

  // Marriages already recorded for this person, so they can be corrected
  // rather than entered twice.
  const marriages = await prisma.marriage.findMany({
    where: {
      status: PersonStatus.APPROVED,
      deletedAt: null,
      OR: [{ partnerAId: person.id }, { partnerBId: person.id }],
    },
    include: {
      partnerA: { select: { id: true, firstName: true, lastName: true } },
      partnerB: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { startDate: "asc" },
  });

  const existing = marriages.map((marriage) => {
    const spouse =
      marriage.partnerAId === person.id ? marriage.partnerB : marriage.partnerA;
    return {
      id: marriage.id,
      spouseName: `${spouse.firstName} ${spouse.lastName}`,
      startYear: marriage.startDate ? String(marriage.startDate.getUTCFullYear()) : "",
      endYear: marriage.endDate ? String(marriage.endDate.getUTCFullYear()) : "",
      endReason: (marriage.endReason ?? "") as "" | "DIVORCE" | "DEATH",
    };
  });

  return (
    <main className="min-h-dvh bg-[#0d1117] px-4 py-8 text-gray-100 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>

        <h1 className="mt-4 text-xl font-bold sm:text-2xl">
          {existing.length > 0 ? "Marriages of" : "Record a marriage for"}{" "}
          {person.firstName} {person.lastName}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">
          {existing.length > 0
            ? "Correct the dates below, or record another marriage. An admin reviews every change before the tree is updated."
            : "Search for their spouse, or enter someone who married into the family and is not in the register yet. An admin reviews it before it appears on the tree."}
        </p>

        <MarriageForm
          person={{ id: person.id, name: `${person.firstName} ${person.lastName}` }}
          existing={existing}
        />
      </div>
    </main>
  );
}
