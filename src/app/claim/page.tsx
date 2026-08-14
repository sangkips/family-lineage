import { redirect } from "next/navigation";
import Link from "next/link";
import ChildWizard from "@/components/claim/ChildWizard";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClaimPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

        {profile?.person ? (
          <div className="mt-6 rounded-2xl border border-gray-800 bg-[#161b22] p-8">
            <h1 className="text-xl font-bold">You&apos;re in the tree 🎉</h1>
            <p className="mt-2 text-sm text-gray-400">
              Your account is linked to{" "}
              <span className="font-semibold text-gray-200">
                {profile.person.firstName} {profile.person.lastName}
              </span>
              {profile.person.status !== "APPROVED" && (
                <span className="ml-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-300">
                  pending approval
                </span>
              )}
              .
            </p>
            <p className="mt-4 text-sm text-gray-400">
              You can only claim one place in the tree.
            </p>
          </div>
        ) : (
          <ChildWizard mode="claim" />
        )}
      </div>
    </main>
  );
}
