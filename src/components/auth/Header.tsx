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
  // One action, one name: the button and the menu entry both say "Add a
  // person", because they go to the same place.
  const menuItems: HeaderMenuItem[] = isAdmin
    ? [{ href: "/admin", label: "Moderation queue", tone: "admin" as const }]
    : [];

  return (
    <header className="band flex shrink-0 items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <div className="flex min-w-0 items-baseline gap-3">
        <Link
          href="/"
          className="shrink-0 font-display text-[15px] font-bold uppercase tracking-[0.08em] text-white sm:text-base"
          style={{ fontStretch: "87.5%" }}
        >
          The Family Register
        </Link>
        {typeof peopleCount === "number" && (
          <p className="tnum hidden text-[13px] text-white/70 sm:block">
            {peopleCount} people · {linkCount ?? 0} parent links
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden rounded-full border border-white/25 px-3 py-1 text-xs text-white/70 lg:inline">
          Scroll to zoom · Drag to pan · Tap a person for details
        </span>

        <Link
          href="/add"
          className="flex min-h-11 items-center rounded-lg bg-white px-3.5 text-[13px] font-semibold text-cobalt transition-colors hover:bg-cobalt-wash sm:min-h-9"
        >
          Add a person
        </Link>

        <HeaderMenu items={menuItems} email={user?.email}>
          {user && <SignOutButton />}
        </HeaderMenu>
      </div>
    </header>
  );
}
