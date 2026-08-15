import Link from "next/link";
import { UserRole } from "@/generated/prisma/client";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/profile";
import HeaderMenu, { type HeaderMenuItem } from "./HeaderMenu";
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

  const profile = user ? await getOrCreateProfile(user) : null;
  const isAdmin = profile?.role === UserRole.ADMIN;

  // Contributing needs no account, so "Add yourself" is the primary action for
  // everyone. Sign-in is not offered here — the admin navigates to /login.
  const menuItems: HeaderMenuItem[] = isAdmin
    ? [
        { href: "/admin", label: "Moderation queue", tone: "admin" as const },
        { href: "/add", label: "Add a person" },
      ]
    : [{ href: "/add", label: "Add a person" }];

  return (
    <header className="flex items-center justify-between gap-3 border-b border-gray-800 px-4 py-2.5 sm:px-6 sm:py-3">
      <div className="flex min-w-0 items-baseline gap-3">
        <Link
          href="/"
          className="shrink-0 text-base font-bold text-gray-100 hover:text-white sm:text-lg"
        >
          Family Tree
        </Link>
        {typeof peopleCount === "number" && (
          <p className="hidden text-sm text-gray-400 sm:block">
            {peopleCount} people · {linkCount ?? 0} parent links
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden rounded-full border border-gray-700 bg-[#161b22] px-3 py-1 text-xs text-gray-400 lg:inline">
          Scroll to zoom · Drag to pan · Click a person for details
        </span>

        <Link
          href="/add"
          className="flex min-h-11 items-center rounded-lg bg-[#58a6ff] px-3 text-xs font-semibold text-[#0d1117] transition-opacity hover:opacity-90 sm:min-h-9"
        >
          Add yourself
        </Link>

        <HeaderMenu items={menuItems} email={user?.email}>
          {user && <SignOutButton />}
        </HeaderMenu>
      </div>
    </header>
  );
}
