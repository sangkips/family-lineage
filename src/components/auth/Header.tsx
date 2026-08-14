import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import SignOutButton from "./SignOutButton";

type HeaderProps = {
  peopleCount?: number;
  linkCount?: number;
};

export default async function Header({ peopleCount, linkCount }: HeaderProps) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Has this member claimed a node yet? Controls Claim me vs Edit profile.
  const profile = user
    ? await prisma.profile.findUnique({
        where: { userId: user.id },
        select: { personId: true },
      })
    : null;

  return (
    <header className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
      <div className="flex items-baseline gap-3">
        <Link href="/" className="text-lg font-bold text-gray-100 hover:text-white">
          Family Tree
        </Link>
        {typeof peopleCount === "number" && (
          <p className="text-sm text-gray-400">
            {peopleCount} people · {linkCount ?? 0} parent links
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="hidden rounded-full border border-gray-700 bg-[#161b22] px-3 py-1 text-xs text-gray-400 md:inline">
          Scroll to zoom · Drag to pan · Click a person for details
        </span>

        {user ? (
          <>
            <Link
              href="/add"
              className="rounded-lg border border-gray-700 bg-[#161b22] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
            >
              Add child
            </Link>
            {profile ? (
              <Link
                href="/profile"
                className="rounded-lg border border-gray-700 bg-[#161b22] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
              >
                Edit profile
              </Link>
            ) : (
              <Link
                href="/claim"
                className="rounded-lg bg-[#58a6ff] px-3 py-1.5 text-xs font-semibold text-[#0d1117] transition-opacity hover:opacity-90"
              >
                Claim me
              </Link>
            )}
            <span className="max-w-[160px] truncate text-xs text-gray-400">
              {user.email}
            </span>
            <SignOutButton />
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-lg border border-gray-700 bg-[#161b22] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-[#58a6ff] px-3 py-1.5 text-xs font-semibold text-[#0d1117] transition-opacity hover:opacity-90"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
