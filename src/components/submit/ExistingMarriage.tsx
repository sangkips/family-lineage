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

const field = "field";

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
      className="card p-4 sm:p-6"
    >
      <p className="section-heading">Married to {marriage.spouseName}</p>

      {done ? (
        <p className="notice notice-approved mt-3">
          Correction sent — an admin will review it.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`start-${marriage.id}`}
                className="field-label mb-1"
              >
                Year they married
              </label>
              <input
                id={`start-${marriage.id}`}
                inputMode="numeric"
                value={startYear}
                onChange={(e) => setStartYear(e.target.value)}
                placeholder="e.g. 1965"
                className={`${field} tnum`}
              />
            </div>
          </div>

          <label className="mt-4 flex min-h-11 items-center gap-2 text-[15px] text-ink">
            <input
              type="checkbox"
              checked={ended}
              onChange={(e) => setEnded(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-cobalt)]"
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
                className={`${field} tnum`}
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

          {error && <p className="notice notice-error mt-3">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !changed}
            className="btn btn-quiet mt-4"
          >
            {submitting ? "Sending…" : "Send correction"}
          </button>
        </>
      )}
    </form>
  );
}
