import { notFound } from "next/navigation";
import RegisterPage from "@/components/chrome/RegisterPage";
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
    <RegisterPage
      hem="contribute"
      eyebrow={`${person.firstName} ${person.lastName}`}
      title={existing.length > 0 ? "Marriages" : "Record a marriage"}
      intro={
        existing.length > 0
          ? "Correct the dates below, or record another marriage."
          : "Search for their spouse, or enter someone who married into the family and is not in the register yet."
      }
      jina="An admin reviews every marriage before it appears on the tree."
    >
      <MarriageForm
        person={{ id: person.id, name: `${person.firstName} ${person.lastName}` }}
        existing={existing}
      />
    </RegisterPage>
  );
}
