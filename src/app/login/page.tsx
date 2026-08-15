"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        // Accounts exist only to moderate, so the queue is where sign-in leads.
        router.push("/admin");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0d1117] px-4 text-gray-100">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-[#161b22] p-5 shadow-xl sm:p-8">
        <h1 className="text-xl font-bold">Admin sign-in</h1>
        <p className="mt-1 text-sm text-gray-400">
          For tree admins reviewing submissions. To add yourself or a relative,
          go back to the tree and tap Add — no account needed.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-gray-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] min-h-11 px-3 py-2 text-base outline-none focus:border-[#58a6ff] sm:min-h-0 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-gray-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] min-h-11 px-3 py-2 text-base outline-none focus:border-[#58a6ff] sm:min-h-0 sm:text-sm"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="min-h-11 w-full rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          New here?{" "}
          <Link href="/signup" className="inline-flex min-h-11 items-center px-1 text-[#58a6ff] hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
