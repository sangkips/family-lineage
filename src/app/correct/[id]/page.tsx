import Link from "next/link";
import { notFound } from "next/navigation";
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
    <main className="min-h-dvh bg-[#0d1117] px-4 py-8 text-gray-100 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>

        <h1 className="mt-4 text-xl font-bold sm:text-2xl">
          Suggest a correction
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">
          Change anything that is wrong about {person.firstName} {person.lastName}.
          Only what you change is sent, and an admin reviews it before the tree
          is updated.
        </p>

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
      </div>
    </main>
  );
}
