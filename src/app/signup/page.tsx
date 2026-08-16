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
      // Accounts exist only for admins now — relatives contribute without one.
      const check = await fetch("/api/admin/allowed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const { allowed } = await check.json();
      if (!allowed) {
        setError(
          "This register does not use accounts. Anyone can add to the tree without signing in — use “Add” on the tree instead."
        );
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
        },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation is disabled — session is already active.
        router.push("/admin");
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
    <main className="flex min-h-dvh items-center justify-center bg-field px-4">
      <div className="card w-full max-w-sm p-5 sm:p-8">
        <p className="eyebrow">The register</p>
        <h1 className="title mt-1.5 text-[26px]">Create an admin account</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Accounts are for admins only. To add yourself or a relative, go back to
          the tree and tap Add a person — no account needed.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="field-label mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="password" className="field-label mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </div>

          {error && <p className="notice notice-error">{error}</p>}
          {message && <p className="notice notice-approved">{message}</p>}

          <button type="submit" disabled={loading} className="btn">
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-center text-[15px] text-ink-soft">
          Already a member?{" "}
          <Link href="/login" className="nav-link px-1">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
