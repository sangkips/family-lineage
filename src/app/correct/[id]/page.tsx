import { notFound } from "next/navigation";
import RegisterPage from "@/components/chrome/RegisterPage";
import CorrectionForm from "@/components/submit/CorrectionForm";
import { PersonStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** yyyy-mm-dd for a date input, or "" when unrecorded. */
function dateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

/**
 * /correct/[id] — public "suggest a correction". No sign-in, and nothing is
 * applied until an admin approves it.
 */
export default async function CorrectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const person = await prisma.person.findFirst({
    where: { id, status: PersonStatus.APPROVED, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      maidenName: true,
      birthDate: true,
      birthPlace: true,
      deathDate: true,
      isLiving: true,
      bio: true,
      hideBirthDate: true,
      hideFullName: true,
    },
  });

  if (!person) notFound();

  // A living person who keeps their birth date private does not have it
  // exposed here just because the form is prefilled.
  const private_ = person.isLiving && person.hideBirthDate;

  return (
    <RegisterPage
      hem="contribute"
      eyebrow={`${person.firstName} ${person.lastName}`}
      title="Suggest a correction"
      intro="Change anything that is wrong. Only what you change is sent."
      jina="An admin reviews every correction before the tree is updated."
    >
      <CorrectionForm
          person={{
            id: person.id,
            firstName: person.firstName,
            lastName: person.lastName,
            maidenName: person.maidenName ?? "",
            birthYear:
              private_ || !person.birthDate
                ? ""
                : String(person.birthDate.getUTCFullYear()),
            birthPlace: private_ ? "" : (person.birthPlace ?? ""),
            deathDate: dateInputValue(person.deathDate),
            isLiving: person.isLiving,
            bio: person.bio ?? "",
          }}
        />
    </RegisterPage>
  );
}
