"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { usePersonSearch } from "@/components/tree/usePersonSearch";

const field =
  "w-full min-h-11 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-base outline-none focus:border-[#58a6ff] sm:min-h-0 sm:text-sm";
const label = "mb-1 block text-sm text-gray-300";

type Partner = { id: string; name: string };

/**
 * Record who someone married. Both partners must already be in the register —
 * a marriage links two existing people rather than creating anyone.
 */
export default function MarriageForm({ person }: { person: Partner }) {
  const [spouse, setSpouse] = useState<Partner | null>(null);
  const [startYear, setStartYear] = useState("");
  const [ended, setEnded] = useState(false);
  const [endYear, setEndYear] = useState("");
  const [endReason, setEndReason] = useState<"DIVORCE" | "DEATH">("DEATH");

  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const search = usePersonSearch();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!spouse) {
      setError("Choose who they married.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ADD_MARRIAGE",
          partnerAId: person.id,
          partnerBId: spouse.id,
          startYear: startYear ? Number(startYear) : null,
          endYear: ended && endYear ? Number(endYear) : null,
          endReason: ended ? endReason : null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        toast(body.error ?? "Something went wrong", "error");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again");
      toast("Network error — nothing was sent", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-5 sm:p-8">
        <h2 className="text-xl font-bold text-green-300">Marriage sent for review</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">
          Once an admin approves it, {person.name} and {spouse?.name} will be joined
          on the tree with their own family page.
        </p>
        <Link
          href="/"
          className="mt-5 flex min-h-11 w-full items-center justify-center rounded-lg bg-[#58a6ff] px-4 text-sm font-semibold text-[#0d1117]"
        >
          Back to the tree
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-300">Who did they marry?</h2>

        {spouse ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-gray-700/60 bg-[#0d1117] px-3 py-3">
            <span className="text-sm text-gray-100">{spouse.name}</span>
            <button
              type="button"
              onClick={() => setSpouse(null)}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500"
              aria-label="Choose someone else"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <input
              type="search"
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              placeholder="Search the register by name…"
              aria-label="Search for a spouse by name"
              className={`mt-3 ${field}`}
            />
            <ul className="mt-3 space-y-2">
              {search.results
                .filter((result) => result.id !== person.id)
                .map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSpouse({
                          id: result.id,
                          name: `${result.firstName} ${result.lastName}`,
                        })
                      }
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-gray-700/60 bg-[#0d1117] px-3 text-left"
                    >
                      <span className="text-sm text-gray-200">
                        {result.firstName} {result.lastName}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {result.birthYear ? `b. ${result.birthYear}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            {search.query.trim().length >= 2 &&
              !search.searching &&
              search.results.length === 0 && (
                <p className="mt-3 text-xs text-gray-500">
                  No matches. They need to be added to the register first.
                </p>
              )}
          </>
        )}
      </section>

      <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-4 sm:p-6">
        <div>
          <label htmlFor="startYear" className={label}>
            Year they married
          </label>
          <input
            id="startYear"
            inputMode="numeric"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            placeholder="e.g. 1965"
            className={field}
          />
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={ended}
            onChange={(e) => setEnded(e.target.checked)}
            className="h-4 w-4"
          />
          The marriage has ended
        </label>

        {ended && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              inputMode="numeric"
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
              placeholder="Year it ended"
              aria-label="Year the marriage ended"
              className={field}
            />
            <select
              value={endReason}
              onChange={(e) => setEndReason(e.target.value as "DIVORCE" | "DEATH")}
              aria-label="How the marriage ended"
              className={field}
            >
              <option value="DEATH">Ended by death</option>
              <option value="DIVORCE">Ended by divorce</option>
            </select>
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-lg bg-[#58a6ff] px-4 text-sm font-semibold text-[#0d1117] disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send for approval"}
      </button>
    </form>
  );
}
