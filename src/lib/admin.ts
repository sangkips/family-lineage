import { NextResponse, type NextRequest } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { getUserFromRequest } from "./auth";
import { getOrCreateProfile } from "./profile";
import { createRouteHandlerSupabaseClient } from "./supabase/route-handler";

export type AdminCheck =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Gate for every admin route.
 *
 * The admin is now the only account in the system, so this one check is the
 * whole authorisation model — it lives in a single place so it can be tested
 * once and cannot drift between endpoints.
 */
export async function requireAdmin(request: NextRequest): Promise<AdminCheck> {
  const carrier = NextResponse.json({});
  const supabase = createRouteHandlerSupabaseClient(request, carrier);

  const user = await getUserFromRequest(request, supabase);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not signed in" }, { status: 401 }),
    };
  }

  const profile = await getOrCreateProfile(user);
  if (profile.role !== UserRole.ADMIN) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admins only" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
