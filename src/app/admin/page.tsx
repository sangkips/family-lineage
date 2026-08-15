import { redirect } from "next/navigation";
import Link from "next/link";
import HangingPeople from "@/components/admin/HangingPeople";
import SubmissionCard, {
  type AdminSubmission,
} from "@/components/admin/SubmissionCard";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getOrCreateProfile } from "@/lib/profile";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getOrCreateProfile(user);
  if (profile.role !== UserRole.ADMIN) redirect("/");

  const [submissions, hanging] = await Promise.all([
    prisma.submission.findMany({
      where: { decision: null },
      include: {
        edits: {
          include: {
            person: {
              include: {
                parents: {
                  include: {
                    parent: { select: { id: true, firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.person.findMany({
      where: { deletedAt: null, parents: { none: {} }, children: { none: {} } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        status: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const duplicateIds = [
    ...new Set(submissions.flatMap((s) => s.edits.flatMap((e) => e.duplicateIds))),
  ];
  const duplicates = duplicateIds.length
    ? await prisma.person.findMany({
        where: { id: { in: duplicateIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          birthDate: true,
          birthDatePrecision: true,
          status: true,
        },
      })
    : [];
  const duplicateById = new Map(duplicates.map((d) => [d.id, d]));

  const cards: AdminSubmission[] = submissions.map((submission) => ({
    id: submission.id,
    kind: submission.kind,
    submitterHash: submission.submitterHash,
    submittedAt: submission.submittedAt.toISOString(),
    edits: submission.edits.map((edit) => ({
      id: edit.id,
      requestType: edit.requestType,
      payload: (edit.payload ?? null) as Record<string, unknown> | null,
      person: {
        ...edit.person,
        birthDate: edit.person.birthDate?.toISOString() ?? null,
      },
      parents: edit.person.parents.map((link) => ({
        id: link.parent.id,
        name: `${link.parent.firstName} ${link.parent.lastName}`,
        role: link.role,
      })),
      duplicates: edit.duplicateIds
        .map((id) => duplicateById.get(id))
        .filter((d): d is NonNullable<typeof d> => Boolean(d))
        .map((d) => ({ ...d, birthDate: d.birthDate?.toISOString() ?? null })),
    })),
  }));

  return (
    <main className="min-h-dvh bg-[#0d1117] px-4 py-8 text-gray-100 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>
        <h1 className="mt-4 text-xl font-bold sm:text-2xl">Moderation queue</h1>
        <p className="mt-1 text-sm text-gray-400">
          Anyone can add to the register without an account. Nothing they send
          appears on the tree until you approve it here.
        </p>

        {cards.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-800 bg-[#161b22] p-8 text-center text-sm text-gray-400">
            🎉 Nothing waiting for review.
          </div>
        ) : (
          <ul className="mt-6 space-y-4">
            {cards.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </ul>
        )}

        <HangingPeople
          people={hanging.map((person) => ({
            ...person,
            birthDate: person.birthDate?.toISOString() ?? null,
          }))}
        />
      </div>
    </main>
  );
}
