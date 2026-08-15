"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatFullDate } from "@/lib/person-format";
import type { PersonDTO } from "@/lib/tree";

export type DrawerMarriage = {
  id: string;
  spouse: PersonDTO;
  startYear: number | null;
  endYear: number | null;
  endReason: string | null;
};

type Props = {
  person: PersonDTO;
  parents: PersonDTO[];
  /** Anyone sharing at least one parent — half-siblings included. */
  siblings: PersonDTO[];
  /** Named to avoid colliding with React's own `children` prop. */
  childPeople: PersonDTO[];
  /** Recorded marriages this person is part of. */
  marriages: DrawerMarriage[];
  /** How this person relates to the anchor, when one is set. */
  relation?: string | null;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right text-gray-200">{value}</span>
    </div>
  );
}

function RelativeList({ label, people }: { label: string; people: PersonDTO[] }) {
  if (people.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </h3>
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.id} className="text-sm text-gray-200">
            {p.firstName} {p.lastName}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Person details. A bottom sheet on a phone — a 320px side panel would cover
 * almost the entire screen — and the original side panel from `sm` up.
 */
export default function PersonDrawer({
  person,
  parents,
  siblings,
  childPeople,
  marriages,
  relation,
  onClose,
}: Props) {
  const router = useRouter();

  return (
    <aside
      className="absolute inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col rounded-t-2xl border-t border-gray-800 bg-[#0d1117]/95 backdrop-blur sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:z-10 sm:h-full sm:max-h-none sm:w-80 sm:rounded-none sm:border-l sm:border-t-0"
      role="dialog"
      aria-label={`${person.firstName} ${person.lastName} details`}
    >
      {/* Grab handle — signals "this sheet dismisses" on touch. */}
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-700 sm:hidden" />

      <div className="flex items-start justify-between gap-3 border-b border-gray-800 p-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-100">
            {person.firstName} {person.lastName}
            {person.maidenName && (
              <span className="ml-1 text-sm font-normal text-gray-400">
                (née {person.maidenName})
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500">
            {relation && relation !== "you" && (
              <span className="text-[#79c0ff]">your {relation} · </span>
            )}
            {relation === "you" && <span className="text-[#79c0ff]">this is you · </span>}
            {person.isLiving ? "Living" : "Deceased"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors active:bg-gray-800 sm:h-9 sm:w-9 sm:hover:bg-gray-800 sm:hover:text-gray-200"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      {person.status === "PENDING" && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          ⏳ Awaiting review — visible to admins only until it is approved.
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Row
          label="Birth"
          value={formatFullDate(person.birthDate, person.birthDatePrecision)}
        />
        {person.birthPlace && <Row label="Birthplace" value={person.birthPlace} />}
        {!person.isLiving && <Row label="Death" value={formatFullDate(person.deathDate)} />}
        {person.bio && (
          <p className="mt-3 border-t border-gray-800 pt-3 text-sm leading-relaxed text-gray-300">
            {person.bio}
          </p>
        )}
        {marriages.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Married to
            </h3>
            <ul className="space-y-1.5">
              {marriages.map((marriage) => (
                <li key={marriage.id}>
                  <Link
                    href={`/family/${marriage.id}`}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-gray-800 bg-[#161b22] px-3 text-sm"
                  >
                    <span className="truncate text-gray-100">
                      {marriage.spouse.firstName} {marriage.spouse.lastName}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      {marriage.startYear ?? ""}
                      {marriage.endYear ? `–${marriage.endYear}` : ""} ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <RelativeList label="Parents" people={parents} />
        <RelativeList label="Siblings" people={siblings} />
        <RelativeList label="Children" people={childPeople} />
      </div>

      {/* No sign-in gate: anyone in the family can contribute, and an admin
          approves it before it reaches the public tree. */}
      <div
        className="shrink-0 space-y-2 border-t border-gray-800 p-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => router.push(`/add?parentId=${person.id}`)}
          className="min-h-11 w-full rounded-lg bg-[#58a6ff] px-3 py-2 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90"
        >
          ＋ Add child under {person.firstName}
        </button>
        <button
          onClick={() => router.push(`/marry/${person.id}`)}
          className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#161b22] px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
        >
          ⚭ Record a marriage
        </button>
        <button
          onClick={() => router.push(`/correct/${person.id}`)}
          className="min-h-11 w-full rounded-lg border border-gray-700 bg-[#161b22] px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600 hover:text-gray-100"
        >
          ✎ Suggest a correction
        </button>
      </div>
    </aside>
  );
}
