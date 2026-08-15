import { redirect } from "next/navigation";
import Link from "next/link";
import HangingPeople from "@/components/admin/HangingPeople";
import SubmissionRow, {
  type AdminSubmission,
} from "@/components/admin/SubmissionRow";
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
      where: {
        decision: null,
        // A submission whose people were deleted from the database keeps its
        // row but loses its edits to the cascade. There is nothing left to
        // approve, so it must not appear as a blank line in the queue.
        edits: { some: {} },
      },
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
            marriage: {
              include: {
                partnerA: { select: { firstName: true, lastName: true } },
                partnerB: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
      take: 50,
    }),
    prisma.person.findMany({
      where: {
        deletedAt: null,
        parents: { none: {} },
        children: { none: {} },
        // A marriage connects someone just as surely as a parent link does,
        // so a spouse who married in is not stranded.
        marriagesAsA: { none: {} },
        marriagesAsB: { none: {} },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthDate: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // A hanging person who shares a name with someone in the tree is alarming to
  // look at next to a Delete button: the admin cannot tell which record is
  // which. Flag it so the row can say so outright.
  const namesakes = hanging.length
    ? await prisma.person.findMany({
        where: {
          deletedAt: null,
          id: { notIn: hanging.map((p) => p.id) },
          OR: hanging.map((p) => ({
            firstName: { equals: p.firstName, mode: "insensitive" as const },
            lastName: { equals: p.lastName, mode: "insensitive" as const },
          })),
        },
        select: { firstName: true, lastName: true },
      })
    : [];
  const namesakeKeys = new Set(
    namesakes.map((p) => `${p.firstName.toLowerCase()}|${p.lastName.toLowerCase()}`)
  );

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
      person: edit.person
        ? { ...edit.person, birthDate: edit.person.birthDate?.toISOString() ?? null }
        : null,
      marriage: edit.marriage
        ? {
            id: edit.marriage.id,
            partnerA: `${edit.marriage.partnerA.firstName} ${edit.marriage.partnerA.lastName}`,
            partnerB: `${edit.marriage.partnerB.firstName} ${edit.marriage.partnerB.lastName}`,
            startDate: edit.marriage.startDate?.toISOString() ?? null,
            endDate: edit.marriage.endDate?.toISOString() ?? null,
            endReason: edit.marriage.endReason,
          }
        : null,
      parents: (edit.person?.parents ?? []).map((link) => ({
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
          <ul className="mt-6 space-y-2">
            {cards.map((submission) => (
              <SubmissionRow key={submission.id} submission={submission} />
            ))}
          </ul>
        )}

        <HangingPeople
          people={hanging.map((person) => ({
            ...person,
            birthDate: person.birthDate?.toISOString() ?? null,
            createdAt: person.createdAt.toISOString(),
            hasNamesake: namesakeKeys.has(
              `${person.firstName.toLowerCase()}|${person.lastName.toLowerCase()}`
            ),
          }))}
        />
      </div>
    </main>
  );
}
