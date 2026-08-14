import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Resolve the authenticated user for a route handler.
 * Tries `Authorization: Bearer <token>` first (handy for API clients and
 * tests), then falls back to the cookie-based session.
 */
export async function getUserFromRequest(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<User | null> {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await supabase.auth.getUser(authHeader.slice(7));
    if (data.user) return data.user;
  }
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
