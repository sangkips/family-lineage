"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import { usePersonSearch } from "@/components/tree/usePersonSearch";
import ExistingMarriage, {
  type ExistingMarriageData,
} from "@/components/submit/ExistingMarriage";

const field = "field";
const label = "field-label mb-1";

type Partner = { id: string; name: string };

/**
 * Record who someone married. Both partners must already be in the register —
 * a marriage links two existing people rather than creating anyone.
 */
export default function MarriageForm({
  person,
  existing = [],
}: {
  person: Partner;
  /** Marriages already recorded, shown for correction. */
  existing?: ExistingMarriageData[];
}) {
  // With a marriage already on record, adding another is the rarer act, so it
  // waits behind a button rather than being the first thing on the page.
  const [addingAnother, setAddingAnother] = useState(existing.length === 0);
  const [spouse, setSpouse] = useState<Partner | null>(null);
  /** Details for a spouse who married in and is not in the register. */
  const [outsider, setOutsider] = useState<{
    firstName: string;
    lastName: string;
    birthYear: string;
    gender: "MALE" | "FEMALE" | "OTHER" | "";
  } | null>(null);
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
    if (!spouse && !outsider) {
      setError("Choose who they married, or enter their details.");
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
          partnerBId: spouse?.id ?? undefined,
          newPartner: outsider
            ? {
                firstName: outsider.firstName.trim(),
                lastName: outsider.lastName.trim(),
                birthYear: outsider.birthYear ? Number(outsider.birthYear) : null,
                gender: outsider.gender || null,
              }
            : undefined,
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
      <div className="card border-leaf bg-leaf-wash p-5 sm:p-8">
        <p className="eyebrow text-leaf-ink">Sent for review</p>
        <h2 className="title mt-1.5 text-[24px]">Marriage recorded</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          Once an admin approves it, {person.name} and {spouse?.name} will be joined
          on the tree with their own family page.
        </p>
        <Link href="/" className="btn mt-5">
          Back to the tree
        </Link>
      </div>
    );
  }

  const recorded = (
    <div className="space-y-4">
      {existing.map((marriage) => (
        <ExistingMarriage key={marriage.id} marriage={marriage} />
      ))}
    </div>
  );

  if (!addingAnother) {
    return (
      <>
        {recorded}
        <button
          type="button"
          onClick={() => setAddingAnother(true)}
          className="btn btn-quiet mt-4 min-h-12 border-dashed"
        >
          Record another marriage
        </button>
      </>
    );
  }

  return (
    <>
      {existing.length > 0 && recorded}
      <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card p-4 sm:p-6">
        <h2 className="section-heading">
          {existing.length > 0 ? "Record another marriage" : "Who did they marry?"}
        </h2>

        {spouse ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] border border-seam bg-field px-3 py-2">
            <span className="text-[15px] font-semibold text-ink">{spouse.name}</span>
            <button
              type="button"
              onClick={() => setSpouse(null)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:text-hibiscus"
              aria-label="Choose someone else"
            >
              <svg
                aria-hidden
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          </div>
        ) : outsider ? (
          <div className="mt-3 space-y-3 rounded-[10px] border border-seam bg-field p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">Marrying into the family</p>
              <button
                type="button"
                onClick={() => setOutsider(null)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft hover:text-hibiscus"
                aria-label="Search the register instead"
              >
                <svg
                aria-hidden
                className="h-4 w-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
              </svg>
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                required
                value={outsider.firstName}
                onChange={(e) => setOutsider({ ...outsider, firstName: e.target.value })}
                placeholder="First name *"
                aria-label="Spouse's first name"
                className={field}
              />
              <input
                required
                value={outsider.lastName}
                onChange={(e) => setOutsider({ ...outsider, lastName: e.target.value })}
                placeholder="Last name *"
                aria-label="Spouse's last name"
                className={field}
              />
              <input
                inputMode="numeric"
                value={outsider.birthYear}
                onChange={(e) => setOutsider({ ...outsider, birthYear: e.target.value })}
                placeholder="Birth year"
                aria-label="Spouse's birth year"
                className={field}
              />
              <select
                value={outsider.gender}
                onChange={(e) =>
                  setOutsider({
                    ...outsider,
                    gender: e.target.value as "MALE" | "FEMALE" | "OTHER" | "",
                  })
                }
                aria-label="Spouse's gender"
                className={field}
              >
                <option value="">Gender not given</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
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
                      className="list-row min-h-12 w-full"
                    >
                      <span className="text-[15px] text-ink">
                        {result.firstName} {result.lastName}
                      </span>
                      <span className="tnum shrink-0 text-xs text-ink-soft">
                        {result.birthYear ? `b. ${result.birthYear}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
            {search.query.trim().length >= 2 &&
              !search.searching &&
              search.results.length === 0 && (
                <p className="mt-3 text-[13px] text-ink-soft">
                  No matches in the register.
                </p>
              )}

            {/* Someone marrying in has no relatives here yet, so there is no
                other way to enter them — the marriage is what connects them. */}
            <button
              type="button"
              onClick={() =>
                setOutsider({ firstName: "", lastName: "", birthYear: "", gender: "" })
              }
              className="btn btn-quiet mt-3 border-dashed"
            >
              Not in the register — they married into the family
            </button>
          </>
        )}
      </section>

      <section className="card p-4 sm:p-6">
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
            className={`${field} tnum`}
          />
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
              aria-label="Year the marriage ended"
              className={`${field} tnum`}
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

      {error && <p className="notice notice-error">{error}</p>}

      <button type="submit" disabled={submitting} className="btn min-h-12">
        {submitting ? "Sending…" : "Send for approval"}
      </button>
      </form>
    </>
  );
}
