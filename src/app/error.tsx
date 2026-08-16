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
    <main className="flex min-h-dvh items-center justify-center bg-field px-4">
      <div className="card w-full max-w-sm p-6 text-center">
        <p className="eyebrow">The register</p>
        <h1 className="title mt-1.5 text-[24px]">
          {offline ? "Could not reach the register" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {offline
            ? "The connection dropped on the way to the database. Nothing you did was lost — try again in a moment."
            : "That page failed to load. Trying again often clears it."}
        </p>

        <button onClick={reset} className="btn mt-5">
          Try again
        </button>
        <Link href="/" className="btn btn-quiet mt-2">
          Back to the tree
        </Link>

        {error.digest && (
          <p className="tnum mt-4 text-[11px] text-ink-soft">Reference {error.digest}</p>
        )}
      </div>
    </main>
  );
}
