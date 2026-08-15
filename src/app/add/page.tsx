import Link from "next/link";
import SubmissionForm from "@/components/submit/SubmissionForm";
import { PersonStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * /add — the public front door. No sign-in: anyone in the family can add
 * themselves or a relative, and an admin approves it before it goes live.
 */
export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  // Optional parent pre-selected by "Add child under …" on a person's card.
  const { parentId } = await searchParams;
  let initialParent: { id: string; name: string } | null = null;
  if (parentId) {
    const parent = await prisma.person.findFirst({
      where: { id: parentId, status: PersonStatus.APPROVED, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (parent) {
      initialParent = {
        id: parent.id,
        name: `${parent.firstName} ${parent.lastName}`,
      };
    }
  }

  return (
    <main className="min-h-dvh bg-[#0d1117] px-4 py-8 text-gray-100 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>

        <h1 className="mt-4 text-xl font-bold sm:text-2xl">
          {initialParent
            ? `Add a child under ${initialParent.name}`
            : "Add yourself or a relative"}
        </h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">
          Tell us who they are and who their parents are. A tree admin checks
          every entry before it appears on the tree.
        </p>

        <SubmissionForm initialParent={initialParent} />
      </div>
    </main>
  );
}
