import { NextResponse } from "next/server";

/**
 * POST /api/admin/allowed — is this address allowed to hold an admin account?
 *
 * `ADMIN_EMAILS` is a server secret, so the sign-up page cannot check it
 * directly. Note what this is and is not: it stops a stranger creating a
 * useless account through our form, but the Supabase sign-up API is reachable
 * with the public anon key regardless. The real protections are that
 * `ADMIN_EMAILS` is the only path to the ADMIN role, and that a MEMBER account
 * can do nothing an anonymous visitor cannot. Turn off public sign-ups in the
 * Supabase dashboard to close it entirely.
 */
export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ allowed: false }, { status: 400 });
  }

  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  return NextResponse.json({ allowed: admins.includes(email) });
}
