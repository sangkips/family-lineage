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
    <main className="flex min-h-dvh items-center justify-center bg-field px-4">
      <div className="card w-full max-w-sm p-5 sm:p-8">
        <p className="eyebrow">The register</p>
        <h1 className="title mt-1.5 text-[26px]">Admin sign-in</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          For admins reviewing submissions. To add yourself or a relative, go back
          to the tree and tap Add a person — no account needed.
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
            />
          </div>

          {error && <p className="notice notice-error">{error}</p>}

          <button type="submit" disabled={loading} className="btn">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[15px] text-ink-soft">
          New here?{" "}
          <Link href="/signup" className="nav-link px-1">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}
