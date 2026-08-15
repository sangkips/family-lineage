"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type HangingPerson = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  status: string;
};

/**
 * People connected to nobody — no parent, no child. The submission endpoint
 * refuses to create these, so this list should only ever hold rows that
 * predate that guard, and it should end up empty and stay empty.
 */
export default function HangingPeople({ people }: { people: HangingPerson[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (people.length === 0) return null;

  async function remove(person: HangingPerson) {
    setBusyId(person.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/people/${person.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not delete");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-gray-200">Not connected to anyone</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">
        These people have no parent and no child, so they float beside the tree
        rather than belonging to it. New entries can no longer be saved this way.
      </p>

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <ul className="mt-3 space-y-2">
        {people.map((person) => (
          <li
            key={person.id}
            className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-[#161b22] p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold text-gray-100">
                {person.firstName} {person.lastName}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                {person.birthDate
                  ? `b. ${new Date(person.birthDate).getUTCFullYear()}`
                  : "birth year unknown"}{" "}
                · {person.status.toLowerCase()}
              </p>
            </div>
            <button
              onClick={() => remove(person)}
              disabled={busyId !== null}
              className="min-h-11 rounded-lg border border-red-500/40 bg-red-500/10 px-4 text-xs font-semibold text-red-300 disabled:opacity-40 sm:min-h-9"
            >
              {busyId === person.id ? "…" : "Delete"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
