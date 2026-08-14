"use client";

import { useState, type FormEvent } from "react";

type Gender = "MALE" | "FEMALE" | "OTHER";

type ProfilePerson = {
  id: string;
  firstName: string;
  lastName: string;
  maidenName: string | null;
  gender: Gender | null;
  birthDate: string; // yyyy-mm-dd (date input value) or ""
  deathDate: string;
  birthPlace: string | null;
  deathPlace: string | null;
  bio: string | null;
  isLiving: boolean;
  status: string;
};

const inputClass =
  "w-full rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-sm outline-none focus:border-[#58a6ff]";

export default function ProfileForm({ person }: { person: ProfilePerson }) {
  const [maidenName, setMaidenName] = useState(person.maidenName ?? "");
  const [gender, setGender] = useState<Gender | "">(person.gender ?? "");
  const [birthDate, setBirthDate] = useState(person.birthDate);
  const [birthPlace, setBirthPlace] = useState(person.birthPlace ?? "");
  const [deathDate, setDeathDate] = useState(person.deathDate);
  const [deathPlace, setDeathPlace] = useState(person.deathPlace ?? "");
  const [isLiving, setIsLiving] = useState(person.isLiving);
  const [bio, setBio] = useState(person.bio ?? "");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maidenName: maidenName.trim() || null,
          gender: gender || null,
          birthDate: birthDate || null,
          deathDate: isLiving ? null : deathDate || null,
          birthPlace: birthPlace.trim() || null,
          deathPlace: isLiving ? null : deathPlace.trim() || null,
          bio: bio.trim() || null,
          isLiving,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        return;
      }
      setSaved(true);
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="rounded-2xl border border-gray-800 bg-[#161b22] p-6">
        <h1 className="text-xl font-bold">Edit your profile</h1>
        <p className="mt-1 text-sm text-gray-400">
          {person.firstName} {person.lastName}
          {person.status === "PENDING" && (
            <span className="ml-2 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-300">
              pending approval
            </span>
          )}{" "}
          — changes apply immediately.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-6">
          <h2 className="text-sm font-semibold text-gray-300">Details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="maidenName" className="mb-1 block text-sm text-gray-300">
                Maiden name
              </label>
              <input
                id="maidenName"
                value={maidenName}
                onChange={(e) => setMaidenName(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="gender" className="mb-1 block text-sm text-gray-300">
                Gender
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender | "")}
                className={inputClass}
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
                className={`${inputClass} text-gray-200`}
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
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="deathDate" className="mb-1 block text-sm text-gray-300">
                Death date
              </label>
              <input
                id="deathDate"
                type="date"
                value={deathDate}
                disabled={isLiving}
                onChange={(e) => setDeathDate(e.target.value)}
                className={`${inputClass} text-gray-200 disabled:opacity-40`}
              />
            </div>
            <div>
              <label htmlFor="deathPlace" className="mb-1 block text-sm text-gray-300">
                Death place
              </label>
              <input
                id="deathPlace"
                value={deathPlace}
                disabled={isLiving}
                onChange={(e) => setDeathPlace(e.target.value)}
                className={`${inputClass} disabled:opacity-40`}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 sm:col-span-2">
              <input
                type="checkbox"
                checked={isLiving}
                onChange={(e) => setIsLiving(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-[#0d1117] accent-[#58a6ff]"
              />
              This person is living
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-[#161b22] p-6">
          <h2 className="text-sm font-semibold text-gray-300">Bio</h2>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder="A short life story, notes, or fun facts…"
            className={`${inputClass} mt-4 resize-y leading-relaxed`}
          />
        </section>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        {saved && (
          <p className="rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
            Saved ✓ Your profile is up to date.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-[#58a6ff] px-4 py-2.5 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
