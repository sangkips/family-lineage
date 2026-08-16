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

const field = "field";
const label = "field-label mb-1";

function emptyNewParent(role: Role): ParentSlot {
  return { mode: "new", firstName: "", lastName: "", birthYear: "", gender: "", role };
}

type Spouse = { id: string; name: string; gender: "MALE" | "FEMALE" | "OTHER" | null };

function roleFor(gender: string | null | undefined): Role {
  if (gender === "FEMALE") return "MOTHER";
  if (gender === "MALE") return "FATHER";
  return "PARENT";
}

export default function SubmissionForm({
  initialParent,
  spouseOptions = [],
}: {
  /** Pre-selected parent from "Add child under …" on a person's card. */
  initialParent?: {
    id: string;
    name: string;
    gender?: "MALE" | "FEMALE" | "OTHER" | null;
  } | null;
  /** That parent's spouses, so the second parent needs no searching. */
  spouseOptions?: Spouse[];
}) {
  const [parents, setParents] = useState<ParentSlot[]>(() => {
    if (!initialParent) return [];

    const slots: ParentSlot[] = [
      {
        mode: "existing",
        personId: initialParent.id,
        name: initialParent.name,
        role: roleFor(initialParent.gender),
      },
    ];

    // A child of a married couple belongs to both of them. With exactly one
    // marriage the spouse is filled in outright; with several, the choice is
    // left visible rather than guessed.
    if (spouseOptions.length === 1) {
      slots.push({
        mode: "existing",
        personId: spouseOptions[0].id,
        name: spouseOptions[0].name,
        role: roleFor(spouseOptions[0].gender),
      });
    }

    return slots;
  });

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
      <div className="card border-leaf bg-leaf-wash p-5 sm:p-8">
        <p className="eyebrow text-leaf-ink">Sent for review</p>
        <h2 className="title mt-1.5 text-[24px]">Thank you</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          An admin will check the details and add them to the register. Entries stay
          private until they are approved, so you will not see them on the tree
          straight away.
        </p>
        <Link href="/" className="btn mt-5">
          Back to the tree
        </Link>
      </div>
    );
  }

  // The parent is already settled when arriving from someone's card, so it
  // collapses to a line rather than a step to work through.
  // Several marriages on record: which household is this child from?
  const chooseSpouse =
    spouseOptions.length > 1 &&
    parents.length === 1 &&
    !parents.some((p) => p.mode === "existing" && p.personId !== initialParent?.id);

  const spousePicker = chooseSpouse ? (
    <section className="card border-ochre bg-ochre-wash p-4">
      <p className="section-heading">Who is the other parent?</p>
      <p className="mt-1 text-[13px] text-ink-soft">
        {initialParent?.name} has more than one marriage recorded.
      </p>
      <ul className="mt-3 space-y-2">
        {spouseOptions.map((spouse) => (
          <li key={spouse.id}>
            <button
              type="button"
              onClick={() =>
                setParents((prev) => [
                  ...prev,
                  {
                    mode: "existing",
                    personId: spouse.id,
                    name: spouse.name,
                    role: roleFor(spouse.gender),
                  },
                ])
              }
              className="list-row min-h-12 w-full text-[15px]"
            >
              {spouse.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  ) : null;

  const parentSummary = (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{parents.length > 1 ? "Parents" : "Parent"}</p>
          <p className="mt-0.5 truncate text-[15px] text-ink">
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
          className="btn btn-quiet btn-inline shrink-0 text-[13px]"
        >
          Change
        </button>
      </div>
    </section>
  );

  const parentsPicker = (
    <section className="card p-4 sm:p-6">
      <h2 className="section-heading">Who are the parents?</h2>
      <p className="mt-1 text-[13px] text-ink-soft">
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
                      className="list-row min-h-12 w-full"
                    >
                      <span className="text-[15px] text-ink">
                        {result.firstName} {result.lastName}
                      </span>
                      <span className="tnum shrink-0 text-xs text-ink-soft">
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
                <p className="mt-3 text-[13px] text-ink-soft">No matches found.</p>
              )}

            <button
              type="button"
              onClick={() => setParents([...parents, emptyNewParent("PARENT")])}
              className="btn btn-quiet mt-3 border-dashed"
            >
              Parent is not in the tree — enter their details
            </button>
          </>
        )}

        <ul className="mt-4 space-y-3">
          {parents.map((parent, index) => (
            <li
              key={index}
              className="rounded-[10px] border border-seam bg-field p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[15px] font-semibold text-ink">
                  {parent.mode === "existing" ? parent.name : "New parent"}
                </p>
                <button
                  type="button"
                  onClick={() => setParents(parents.filter((_, i) => i !== index))}
                  aria-label="Remove this parent"
                  className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft hover:text-hibiscus"
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
    <section className="card p-4 sm:p-6">
      <h2 className="section-heading">Their details</h2>
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
              className={`${field} tnum disabled:opacity-40`}
            />
            <label className="mt-2 flex min-h-11 items-center gap-2 text-[13px] text-ink-soft">
              <input
                type="checkbox"
                checked={useExactDate}
                onChange={(e) => setUseExactDate(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-cobalt)]"
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
    <form onSubmit={handleSubmit} className="space-y-6">
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
          {spousePicker}
          {parentSummary}
        </>
      )}

      {error && <p className="notice notice-error">{error}</p>}

      <button type="submit" disabled={submitting} className="btn min-h-12">
        {submitting ? "Sending…" : "Send for approval"}
      </button>
    </form>
  );
}
