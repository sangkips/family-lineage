"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/claim`,
        },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation is disabled — session is already active.
        router.push("/claim");
      } else {
        setMessage(
          "Check your email for a confirmation link, then sign in."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0d1117] px-4 text-gray-100">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-[#161b22] p-8 shadow-xl">
        <h1 className="text-xl font-bold">Create your account</h1>
        <p className="mt-1 text-sm text-gray-400">
          Join your family tree and claim your place under your parents.
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
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
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
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          Already a member?{" "}
          <Link href="/login" className="text-[#58a6ff] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
