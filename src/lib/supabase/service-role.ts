import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — full admin access to the Supabase project.
 * NEVER import this into a client component; never expose the key.
 * Used for server-side admin operations (e.g. creating confirmed test users).
 */
export function createServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}
