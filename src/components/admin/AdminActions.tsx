"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminActions({ editId }: { editId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pending/${editId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-300">{error}</span>}
      <button
        onClick={() => act("approve")}
        disabled={busy !== null}
        className="rounded-md border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300 transition-colors hover:bg-green-500/20 disabled:opacity-40"
      >
        {busy === "approve" ? "…" : "Approve"}
      </button>
      <button
        onClick={() => act("reject")}
        disabled={busy !== null}
        className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-40"
      >
        {busy === "reject" ? "…" : "Reject"}
      </button>
    </div>
  );
}
