import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client. Uses cookies (via @supabase/ssr) so sessions
 * are shared with the server. Only import this from client components.
 */
export function createBrowserSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env"
    );
  }
  return createBrowserClient(url, anonKey);
}
