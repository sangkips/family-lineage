"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";
import {
  usePersonSearch,
  type PersonSearchResult,
} from "@/components/tree/usePersonSearch";

type Role = "FATHER" | "MOTHER" | "PARENT";
type Gender = "MALE" | "FEMALE" | "OTHER" | "";

/** A parent slot is either someone chosen from the register, or typed in. */
type ParentSlot =
  | { mode: "existing"; personId: string; name: string; role: Role }
  | {
      mode: "new";
      firstName: string;
      lastName: string;
      birthYear: string;
      gender: Gender;
      role: Role;
    };

const MAX_PARENTS = 2;

const field =
  "w-full min-h-11 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-base outline-none focus:border-[#58a6ff] sm:min-h-0 sm:text-sm";
const label = "mb-1 block text-sm text-gray-300";

function emptyNewParent(role: Role): ParentSlot {
  return { mode: "new", firstName: "", lastName: "", birthYear: "", gender: "", role };
}

export default function SubmissionForm({
  initialParent,
}: {
  /** Pre-selected parent from "Add child under …" on a person's card. */
  initialParent?: {
    id: string;
    name: string;
    gender?: "MALE" | "FEMALE" | "OTHER" | null;
  } | null;
}) {
  const [parents, setParents] = useState<ParentSlot[]>(() =>
    initialParent
      ? [
          {
            mode: "existing",
            personId: initialParent.id,
            name: initialParent.name,
            role:
              initialParent.gender === "FEMALE"
                ? "MOTHER"
                : initialParent.gender === "MALE"
                  ? "FATHER"
                  : "PARENT",
          },
        ]
      : []
  );

  // Arriving from "Add child under …" means the parent is already settled, so
  // the picker starts folded away and the form opens on the child's details.
  const [showParents, setShowParents] = useState(!initialParent);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [maidenName, setMaidenName] = useState("");
  const [gender, setGender] = useState<Gender>("");
  const [birthYear, setBirthYear] = useState("");
  const [exactDate, setExactDate] = useState("");
  const [useExactDate, setUseExactDate] = useState(false);
  const [birthPlace, setBirthPlace] = useState("");

  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const search = usePersonSearch();

  function chooseParent(result: PersonSearchResult) {
    if (parents.length >= MAX_PARENTS) return;
    if (parents.some((p) => p.mode === "existing" && p.personId === result.id)) return;
    setParents([
      ...parents,
      {
        mode: "existing",
        personId: result.id,
        name: `${result.firstName} ${result.lastName}`,
        role: result.gender === "FEMALE" ? "MOTHER" : result.gender === "MALE" ? "FATHER" : "PARENT",
      },
    ]);
    search.clear();
  }

  function updateParent(index: number, patch: Partial<ParentSlot>) {
    setParents(parents.map((p, i) => (i === index ? ({ ...p, ...patch } as ParentSlot) : p)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (parents.length === 0) {
      setError("Add at least one parent so we know where you belong in the tree.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ADD_PEOPLE",
          person: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            maidenName: maidenName.trim() || null,
            gender: gender || null,
            birthYear: useExactDate ? null : Number(birthYear),
            birthDate: useExactDate ? exactDate : null,
            birthPlace: birthPlace.trim() || null,
          },
          parents: parents.map((parent) =>
            parent.mode === "existing"
              ? { mode: "existing", parentId: parent.personId, role: parent.role }
              : {
                  mode: "new",
                  firstName: parent.firstName.trim(),
                  lastName: parent.lastName.trim(),
                  birthYear: parent.birthYear ? Number(parent.birthYear) : null,
                  gender: parent.gender || null,
                  role: parent.role,
                }
          ),
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
        <h1 className="text-xl font-bold text-green-300">Thank you — sent for review</h1>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">
          A tree admin will check the details and add them to the register. Entries
          stay private until they are approved, so you will not see them on the tree
          straight away.
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

  // The parent is already settled when arriving from someone's card, so it
  // collapses to a line rather than a step to work through.
  const parentSummary = (
    <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-gray-500">Parent</p>
          <p className="mt-0.5 truncate text-sm text-gray-100">
            {parents
              .map((p) =>
                p.mode === "existing"
                  ? `${p.name} (${p.role.toLowerCase()})`
                  : `${p.firstName} ${p.lastName}`.trim() || "new parent"
              )
              .join(" and ")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowParents(true)}
          className="min-h-11 shrink-0 rounded-lg border border-gray-700 px-3 text-xs text-gray-300"
        >
          Change
        </button>
      </div>
    </section>
  );

  const parentsPicker = (
    <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-300">Who are the parents?</h2>
      <p className="mt-1 text-xs text-gray-500">
        Search the register, or enter a parent by hand if they are not in it yet.
      </p>

        {parents.length < MAX_PARENTS && (
          <>
            <input
              type="search"
              value={search.query}
              onChange={(e) => search.setQuery(e.target.value)}
              placeholder="Search for a parent by name…"
              aria-label="Search for a parent by name"
              className={`mt-4 ${field}`}
            />

            {search.results.length > 0 && (
              <ul className="mt-3 space-y-2">
                {search.results.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => chooseParent(result)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-gray-700/60 bg-[#0d1117] px-3 py-2.5 text-left"
                    >
                      <span className="text-sm text-gray-200">
                        {result.firstName} {result.lastName}
                      </span>
                      <span className="shrink-0 text-xs text-gray-500">
                        {result.birthYear ? `b. ${result.birthYear}` : "year unknown"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {search.query.trim().length >= 2 &&
              !search.searching &&
              search.results.length === 0 && (
                <p className="mt-3 text-xs text-gray-500">No matches found.</p>
              )}

            <button
              type="button"
              onClick={() => setParents([...parents, emptyNewParent("PARENT")])}
              className="mt-3 min-h-11 w-full rounded-lg border border-dashed border-gray-700 px-3 text-sm text-gray-300"
            >
              ＋ Parent is not in the tree — enter their details
            </button>
          </>
        )}

        <ul className="mt-4 space-y-3">
          {parents.map((parent, index) => (
            <li
              key={index}
              className="rounded-lg border border-gray-700/60 bg-[#0d1117] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-gray-200">
                  {parent.mode === "existing" ? parent.name : "New parent"}
                </p>
                <button
                  type="button"
                  onClick={() => setParents(parents.filter((_, i) => i !== index))}
                  aria-label="Remove this parent"
                  className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500"
                >
                  ✕
                </button>
              </div>

              {parent.mode === "new" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    required
                    value={parent.firstName}
                    onChange={(e) => updateParent(index, { firstName: e.target.value })}
                    placeholder="First name *"
                    aria-label="Parent's first name"
                    className={field}
                  />
                  <input
                    required
                    value={parent.lastName}
                    onChange={(e) => updateParent(index, { lastName: e.target.value })}
                    placeholder="Last name *"
                    aria-label="Parent's last name"
                    className={field}
                  />
                  <input
                    inputMode="numeric"
                    value={parent.birthYear}
                    onChange={(e) => updateParent(index, { birthYear: e.target.value })}
                    placeholder="Birth year"
                    aria-label="Parent's birth year"
                    className={field}
                  />
                  <select
                    value={parent.gender}
                    onChange={(e) =>
                      updateParent(index, { gender: e.target.value as Gender })
                    }
                    aria-label="Parent's gender"
                    className={field}
                  >
                    <option value="">Gender not given</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              )}

              <select
                value={parent.role}
                onChange={(e) => updateParent(index, { role: e.target.value as Role })}
                aria-label="This parent is the"
                className={`mt-3 ${field}`}
              >
                <option value="FATHER">Father</option>
                <option value="MOTHER">Mother</option>
                <option value="PARENT">Parent</option>
              </select>
            </li>
          ))}
        </ul>
    </section>
  );

  const detailsSection = (
    <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-300">Their details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={label}>
              First name *
            </label>
            <input
              id="firstName"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={label}>
              Last name *
            </label>
            <input
              id="lastName"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className={field}
            />
          </div>

          {gender === "FEMALE" && (
            <div>
              <label htmlFor="maidenName" className={label}>
                Maiden name
              </label>
              <input
                id="maidenName"
                value={maidenName}
                onChange={(e) => setMaidenName(e.target.value)}
                className={field}
              />
            </div>
          )}

          <div>
            <label htmlFor="gender" className={label}>
              Gender
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
              className={field}
            >
              <option value="">Prefer not to say</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="birthYear" className={label}>
              Birth year *
            </label>
            <input
              id="birthYear"
              inputMode="numeric"
              required={!useExactDate}
              disabled={useExactDate}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="e.g. 1948"
              className={`${field} disabled:opacity-40`}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-gray-400">
              <input
                type="checkbox"
                checked={useExactDate}
                onChange={(e) => setUseExactDate(e.target.checked)}
                className="h-4 w-4"
              />
              I know the exact date
            </label>
            {useExactDate && (
              <input
                type="date"
                required
                value={exactDate}
                onChange={(e) => setExactDate(e.target.value)}
                aria-label="Exact birth date"
                className={`mt-2 ${field}`}
              />
            )}
          </div>

          <div>
            <label htmlFor="birthPlace" className={label}>
              Birthplace
            </label>
            <input
              id="birthPlace"
              value={birthPlace}
              onChange={(e) => setBirthPlace(e.target.value)}
              className={field}
            />
          </div>
        </div>
    </section>
  );

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-6">
      {/* With the parent already known, the child's details come first and the
          parent sits underneath as a line that can still be changed. */}
      {showParents ? (
        <>
          {parentsPicker}
          {detailsSection}
        </>
      ) : (
        <>
          {detailsSection}
          {parentSummary}
        </>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-lg bg-[#58a6ff] px-4 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send for approval"}
      </button>
      <p className="pb-4 text-center text-xs text-gray-500">
        No account needed. An admin reviews every entry before it appears.
      </p>
    </form>
  );
}
