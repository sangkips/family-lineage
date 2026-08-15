"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Anything that throws while rendering a page lands here instead of a raw
 * error screen. Losing the connection for a moment is ordinary on a mobile
 * network, so the common case gets its own wording and a retry rather than a
 * stack trace.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  const offline =
    /EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|P1001|P1017|Connection terminated/i.test(
      error.message
    );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#0d1117] px-4 text-gray-100">
      <div className="w-full max-w-sm rounded-2xl border border-gray-800 bg-[#161b22] p-6 text-center">
        <h1 className="text-lg font-bold">
          {offline ? "Could not reach the register" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-400">
          {offline
            ? "The connection dropped on the way to the database. Nothing you did was lost — try again in a moment."
            : "That page failed to load. Trying again often clears it."}
        </p>

        <button
          onClick={reset}
          className="mt-5 min-h-11 w-full rounded-lg bg-[#58a6ff] px-4 text-sm font-semibold text-[#0d1117]"
        >
          Try again
        </button>
        <Link
          href="/"
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-700 px-4 text-sm text-gray-300"
        >
          Back to the tree
        </Link>

        {error.digest && (
          <p className="mt-4 text-[11px] text-gray-600">Reference {error.digest}</p>
        )}
      </div>
    </main>
  );
}
