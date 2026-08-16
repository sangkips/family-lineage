"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export type HangingPerson = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  status: string;
  createdAt: string;
  /** Someone else in the register has the same name. */
  hasNamesake: boolean;
};

/**
 * People connected to nobody — no parent, no child. The submission endpoint
 * refuses to create these, so this list should only ever hold rows that
 * predate that guard, and should end up empty and stay empty.
 *
 * Two of these commonly share a name (a duplicate entered by hand instead of
 * being linked to the existing person), so each row has to say plainly which
 * record it is before offering to delete it.
 */
export default function HangingPeople({ people }: { people: HangingPerson[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Deleted rows vanish immediately rather than waiting for the refetch. */
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());

  const visible = people.filter((person) => !removedIds.has(person.id));
  if (visible.length === 0) return null;

  async function remove(person: HangingPerson) {
    setBusyId(person.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/people/${person.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Could not delete");
        toast(body.error ?? "Could not delete", "error");
        return;
      }
      setConfirmId(null);
      setRemovedIds((prev) => new Set(prev).add(person.id));
      toast(`Deleted ${person.firstName} ${person.lastName}`);
      router.refresh();
    } catch {
      setError("Network error");
      toast("Network error — nothing was deleted", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="section-heading">Not connected to anyone</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
        These people have no parent and no child, so they float beside the tree
        rather than belonging to it. New entries can no longer be saved this way.
      </p>

      {error && <p className="notice notice-error mt-2">{error}</p>}

      <ul className="mt-3 space-y-2">
        {visible.map((person) => (
          <li
            key={person.id}
            className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="section-heading">
                {person.firstName} {person.lastName}
              </p>
              <p className="tnum mt-0.5 text-[13px] text-ink-soft">
                {person.birthDate
                  ? `b. ${new Date(person.birthDate).getUTCFullYear()}`
                  : "birth year unknown"}{" "}
                · no parents, no children · added{" "}
                {new Date(person.createdAt).toLocaleDateString()}
              </p>

              {person.hasNamesake && (
                <p className="notice notice-pending mt-2 text-[13px]">
                  Another {person.firstName} {person.lastName} is in the tree with
                  relatives. This is a separate, unconnected record — deleting it
                  leaves that one untouched.
                </p>
              )}

              <Link
                href={`/?focus=${person.id}`}
                target="_blank"
                className="nav-link mt-0.5 text-[13px]"
              >
                See this record on the tree ↗
              </Link>
            </div>

            {confirmId === person.id ? (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => remove(person)}
                  disabled={busyId !== null}
                  className="btn btn-inline border-hibiscus bg-hibiscus px-4 text-[13px] hover:bg-hibiscus"
                >
                  {busyId === person.id ? "…" : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  disabled={busyId !== null}
                  className="btn btn-quiet btn-inline px-4 text-[13px]"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmId(person.id)}
                className="btn btn-danger btn-inline shrink-0 px-4 text-[13px]"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
