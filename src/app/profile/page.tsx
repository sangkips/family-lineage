import { redirect } from "next/navigation";
import Link from "next/link";
import ProfileForm from "@/components/profile/ProfileForm";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  // The claim/add flows store dates at UTC midnight, so slicing the ISO
  // string round-trips back to the exact day the user picked.
  return date.toISOString().slice(0, 10);
}

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
    include: { person: true },
  });

  return (
    <main className="min-h-dvh bg-[#0d1117] px-4 py-10 text-gray-100">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>

        {!profile?.person ? (
          <div className="mt-6 rounded-2xl border border-gray-800 bg-[#161b22] p-8">
            <h1 className="text-xl font-bold">You haven&apos;t claimed a place yet</h1>
            <p className="mt-2 text-sm text-gray-400">
              Claim your place in the tree first — then you&apos;ll be able to
              edit your bio, dates and details.
            </p>
            <Link
              href="/claim"
              className="mt-4 inline-block rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90"
            >
              Claim me
            </Link>
          </div>
        ) : (
          <ProfileForm
            person={{
              id: profile.person.id,
              firstName: profile.person.firstName,
              lastName: profile.person.lastName,
              maidenName: profile.person.maidenName,
              gender: profile.person.gender,
              birthDate: toDateInputValue(profile.person.birthDate),
              deathDate: toDateInputValue(profile.person.deathDate),
              birthPlace: profile.person.birthPlace,
              deathPlace: profile.person.deathPlace,
              bio: profile.person.bio,
              isLiving: profile.person.isLiving,
              hideBirthDate: profile.person.hideBirthDate,
              hideFullName: profile.person.hideFullName,
              status: profile.person.status,
            }}
          />
        )}
      </div>
    </main>
  );
}
