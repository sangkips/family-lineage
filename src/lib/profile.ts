import { UserRole } from "@/generated/prisma/client";
import { prisma } from "./prisma";

export type AuthUser = { id: string; email?: string | null };

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Ensure a signed-in user has a Profile row, creating it lazily on first
 * check. This is what makes "admin at signup" work without coupling the role
 * to claiming a node:
 *
 * - A brand-new account gets a Profile (role = MEMBER by default) the first
 *   time any page/API resolves them.
 * - If their email is in `ADMIN_EMAILS`, they are created as ADMIN — and
 *   **re-promoted on every check**, so adding an address to the env var takes
 *   effect immediately (no manual DB edit).
 *
 * `ADMIN_EMAILS` is the only route to ADMIN. There used to be a bootstrap that
 * promoted the first account in an empty database, which on a fresh deployment
 * with a reachable sign-up page hands admin to whichever stranger arrives
 * first. A MEMBER account can do nothing an anonymous visitor cannot.
 *
 * The role is deliberately never downgraded by this function.
 */
export async function getOrCreateProfile(user: AuthUser) {
  const email = user.email?.toLowerCase() ?? "";
  const wantsAdmin = adminEmails().includes(email);

  const existing = await prisma.profile.findUnique({
    where: { userId: user.id },
  });

  if (existing) {
    // Self-healing: promote if the email now matches ADMIN_EMAILS.
    if (wantsAdmin && existing.role !== UserRole.ADMIN) {
      return prisma.profile.update({
        where: { userId: user.id },
        data: { role: UserRole.ADMIN },
      });
    }
    return existing;
  }

  return prisma.profile.create({
    data: {
      userId: user.id,
      role: wantsAdmin ? UserRole.ADMIN : UserRole.MEMBER,
    },
  });
}
