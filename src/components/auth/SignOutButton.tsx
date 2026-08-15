"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100 disabled:opacity-50 sm:min-h-9"
    >
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
