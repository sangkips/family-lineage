"use client";

import { useState, type FormEvent } from "react";
import { useToast } from "@/components/ui/Toast";

export type ExistingMarriageData = {
  id: string;
  spouseName: string;
  startYear: string;
  endYear: string;
  endReason: "" | "DIVORCE" | "DEATH";
};

const field =
  "w-full min-h-11 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-base outline-none focus:border-[#58a6ff] sm:min-h-0 sm:text-sm";

/**
 * Correct a marriage already in the register. Only the dates are editable —
 * changing who married whom is a different marriage, and belongs in a new
 * record rather than an edit of this one.
 */
export default function ExistingMarriage({
  marriage,
}: {
  marriage: ExistingMarriageData;
}) {
  const { toast } = useToast();
  const [startYear, setStartYear] = useState(marriage.startYear);
  const [ended, setEnded] = useState(Boolean(marriage.endYear));
  const [endYear, setEndYear] = useState(marriage.endYear);
  const [endReason, setEndReason] = useState<"DIVORCE" | "DEATH">(
    marriage.endReason === "DIVORCE" ? "DIVORCE" : "DEATH"
  );
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed =
    startYear !== marriage.startYear ||
    (ended ? endYear : "") !== marriage.endYear ||
    (ended ? endReason : "") !== marriage.endReason;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!changed) {
      setError("Nothing has been changed yet.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "EDIT_MARRIAGE",
          marriageId: marriage.id,
          marriageChanges: {
            startYear: startYear ? Number(startYear) : null,
            endYear: ended && endYear ? Number(endYear) : null,
            endReason: ended ? endReason : null,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        toast(body.error ?? "Something went wrong", "error");
        return;
      }
      setDone(true);
      toast("Correction sent for review");
    } catch {
      setError("Network error — please try again");
      toast("Network error — nothing was sent", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-800 bg-[#161b22] p-4 sm:p-6"
    >
      <p className="text-sm font-semibold text-gray-100">
        Married to {marriage.spouseName}
      </p>

      {done ? (
        <p className="mt-2 text-sm text-green-300">
          Correction sent — an admin will review it.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`start-${marriage.id}`}
                className="mb-1 block text-sm text-gray-300"
              >
                Year they married
              </label>
              <input
                id={`start-${marriage.id}`}
                inputMode="numeric"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                placeholder="e.g. 1965"
                className={field}
              />
            </div>
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
                aria-label={`Year the marriage to ${marriage.spouseName} ended`}
                className={field}
              />
              <select
                value={endReason}
                onChange={(e) => setEndReason(e.target.value as "DIVORCE" | "DEATH")}
                aria-label={`How the marriage to ${marriage.spouseName} ended`}
                className={field}
              >
                <option value="DEATH">Ended by death</option>
                <option value="DIVORCE">Ended by divorce</option>
              </select>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !changed}
            className="mt-4 min-h-11 w-full rounded-lg border border-gray-700 bg-[#0d1117] px-4 text-sm font-semibold text-gray-200 disabled:opacity-40"
          >
            {submitting ? "Sending…" : "Send correction"}
          </button>
        </>
      )}
    </form>
  );
}
