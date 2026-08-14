"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  birthYear: number | null;
  isLiving: boolean;
};

type SelectedParent = {
  parentId: string;
  name: string;
  role: "FATHER" | "MOTHER";
};

const MAX_PARENTS = 2;

export default function ClaimWizard() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedParents, setSelectedParents] = useState<SelectedParent[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [maidenName, setMaidenName] = useState("");
  const [gender, setGender] = useState<"MALE" | "FEMALE" | "OTHER" | "">("");
  const [birthDate, setBirthDate] = useState("");
  const [birthPlace, setBirthPlace] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) setResults(await res.json());
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function addParent(result: SearchResult, role: "FATHER" | "MOTHER") {
    if (selectedParents.length >= MAX_PARENTS) return;
    if (selectedParents.some((p) => p.parentId === result.id)) return;
    setSelectedParents([
      ...selectedParents,
      {
        parentId: result.id,
        name: `${result.firstName} ${result.lastName}`,
        role,
      },
    ]);
    setQuery("");
    setResults([]);
  }

  function removeParent(parentId: string) {
    setSelectedParents(selectedParents.filter((p) => p.parentId !== parentId));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          maidenName: maidenName.trim() || null,
          gender: gender || null,
          birthDate: birthDate || null,
          birthPlace: birthPlace.trim() || null,
          parentLinks: selectedParents.map((p) => ({
            parentId: p.parentId,
            role: p.role,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-green-500/40 bg-green-500/10 p-8">
        <h1 className="text-xl font-bold text-green-300">Claim submitted 🎉</h1>
        <p className="mt-2 text-sm text-gray-300">
          You&apos;re in the tree as{" "}
          <span className="font-semibold">
            {firstName} {lastName}
          </span>{" "}
          — pending approval by a tree admin. You&apos;ll appear once an admin
          approves your entry.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold">Claim your place in the tree</h1>
        <p className="mt-1 text-sm text-gray-400">
          Find your parents below, then tell us about yourself. An admin will
          approve your entry before it becomes public.
        </p>
      </div>

      {/* Step 1: parents */}
      <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-6">
        <h2 className="text-sm font-semibold text-gray-300">
          1 · Who are your parents?
        </h2>

        <div className="relative mt-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a parent by name…"
            className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
          />
          {searching && (
            <span className="absolute right-3 top-2.5 text-xs text-gray-500">
              Searching…
            </span>
          )}
        </div>

        {results.length > 0 && (
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-lg border border-gray-700/60 bg-[#0d1117] px-3 py-2"
              >
                <div>
                  <p className="text-sm text-gray-200">
                    {r.firstName} {r.lastName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.birthYear ? `b. ${r.birthYear}` : "birth year unknown"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => addParent(r, "FATHER")}
                    disabled={selectedParents.length >= MAX_PARENTS}
                    className="rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-40"
                  >
                    Father
                  </button>
                  <button
                    type="button"
                    onClick={() => addParent(r, "MOTHER")}
                    disabled={selectedParents.length >= MAX_PARENTS}
                    className="rounded-md border border-pink-500/40 bg-pink-500/10 px-2.5 py-1 text-xs text-pink-300 transition-colors hover:bg-pink-500/20 disabled:opacity-40"
                  >
                    Mother
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && results.length === 0 && !searching && (
          <p className="mt-3 text-xs text-gray-500">No matches found.</p>
        )}

        {selectedParents.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {selectedParents.map((p) => (
              <span
                key={p.parentId}
                className="flex items-center gap-2 rounded-full border border-gray-700 bg-[#0d1117] px-3 py-1 text-xs text-gray-200"
              >
                {p.name}
                <span className="text-gray-500">({p.role.toLowerCase()})</span>
                <button
                  type="button"
                  onClick={() => removeParent(p.parentId)}
                  className="text-gray-500 hover:text-gray-300"
                  aria-label={`Remove ${p.name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        {selectedParents.length === MAX_PARENTS && (
          <p className="mt-2 text-xs text-gray-500">
            You can add up to {MAX_PARENTS} parents.
          </p>
        )}
      </section>

      {/* Step 2: details */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-6">
          <h2 className="text-sm font-semibold text-gray-300">
            2 · Tell us about yourself
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="mb-1 block text-sm text-gray-300">
                First name *
              </label>
              <input
                id="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="mb-1 block text-sm text-gray-300">
                Last name *
              </label>
              <input
                id="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
              />
            </div>
            {gender === "FEMALE" && (
              <div>
                <label htmlFor="maidenName" className="mb-1 block text-sm text-gray-300">
                  Maiden name
                </label>
                <input
                  id="maidenName"
                  value={maidenName}
                  onChange={(e) => setMaidenName(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
                />
              </div>
            )}
            <div>
              <label htmlFor="gender" className="mb-1 block text-sm text-gray-300">
                Gender
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) =>
                  setGender(e.target.value as "MALE" | "FEMALE" | "OTHER" | "")
                }
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
              >
                <option value="">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="birthDate" className="mb-1 block text-sm text-gray-300">
                Birth date
              </label>
              <input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#58a6ff]"
              />
            </div>
            <div>
              <label htmlFor="birthPlace" className="mb-1 block text-sm text-gray-300">
                Birthplace
              </label>
              <input
                id="birthPlace"
                value={birthPlace}
                onChange={(e) => setBirthPlace(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]"
              />
            </div>
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-[#58a6ff] px-4 py-2.5 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit for approval"}
        </button>
      </form>
    </div>
  );
}
