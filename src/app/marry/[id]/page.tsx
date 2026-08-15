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

  return (
    <main className="min-h-dvh bg-[#0d1117] px-4 py-8 text-gray-100 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>

        <h1 className="mt-4 text-xl font-bold sm:text-2xl">
          Record a marriage for {person.firstName} {person.lastName}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">
          Both people must already be in the register. An admin reviews it
          before it appears on the tree.
        </p>

        <MarriageForm
          person={{ id: person.id, name: `${person.firstName} ${person.lastName}` }}
        />
      </div>
    </main>
  );
}
