import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env"
    );
  }
  return { url, anonKey };
}

/**
 * Supabase client for Server Components and Server Actions. Reads the session
 * from cookies; token refreshes write back through next/headers' cookies().
 * Create a new client per render — never share one across requests.
 */
export async function createServerSupabaseClient() {
  const { url, anonKey } = env();
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore since the
          // middleware/route handler will refresh the session.
        }
      },
    },
  });
}
