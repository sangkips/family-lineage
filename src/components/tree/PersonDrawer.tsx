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
    <div className="flex justify-between gap-3 border-b border-seam py-2 text-[15px] last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="tnum text-right text-ink">{value}</span>
    </div>
  );
}

function RelativeList({ label, people }: { label: string; people: PersonDTO[] }) {
  if (people.length === 0) return null;
  return (
    <div className="mt-5">
      <h3 className="eyebrow mb-1.5">{label}</h3>
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.id} className="text-[15px] text-ink">
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
      className="floating absolute inset-x-0 bottom-0 z-30 flex max-h-[70dvh] flex-col rounded-t-2xl border-x-0 border-b-0 sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-0 sm:z-10 sm:h-full sm:max-h-none sm:w-80 sm:rounded-none sm:border-y-0 sm:border-l"
      role="dialog"
      aria-label={`${person.firstName} ${person.lastName} details`}
    >
      {/* Grab handle — signals "this sheet dismisses" on touch. */}
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-seam sm:hidden" />

      <div className="flex items-start justify-between gap-3 border-b border-seam p-4">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-bold leading-tight text-ink">
            {person.firstName} {person.lastName}
          </h2>
          {person.maidenName && (
            <p className="text-[13px] text-ink-soft">née {person.maidenName}</p>
          )}
          <p className="mt-0.5 text-xs text-ink-soft">
            {relation && relation !== "you" && (
              <span className="font-semibold text-hibiscus">your {relation} · </span>
            )}
            {relation === "you" && (
              <span className="font-semibold text-hibiscus">this is you · </span>
            )}
            {person.isLiving ? "Living" : "Deceased"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors active:bg-field sm:h-9 sm:w-9 sm:hover:bg-field sm:hover:text-ink"
          aria-label="Close details"
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

      {person.status === "PENDING" && (
        <div className="border-b border-ochre bg-ochre-wash px-4 py-2 text-xs text-ochre-ink">
          Awaiting review — visible to admins only until it is approved.
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
          <p className="mt-3 text-[15px] leading-relaxed text-ink">{person.bio}</p>
        )}
        {marriages.length > 0 && (
          <div className="mt-5">
            <h3 className="eyebrow mb-1.5">Married to</h3>
            <ul className="space-y-1.5">
              {marriages.map((marriage) => (
                <li key={marriage.id}>
                  <Link href={`/family/${marriage.id}`} className="list-row text-[15px]">
                    <span className="truncate text-ink">
                      {marriage.spouse.firstName} {marriage.spouse.lastName}
                    </span>
                    <span className="tnum shrink-0 text-xs text-ink-soft">
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
        className="shrink-0 space-y-2 border-t border-seam bg-field p-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
      >
        <button onClick={() => router.push(`/add?parentId=${person.id}`)} className="btn">
          Add a child under {person.firstName}
        </button>
        <button
          onClick={() => router.push(`/marry/${person.id}`)}
          className="btn btn-quiet"
        >
          {marriages.length > 0 ? "Edit marriage" : "Record a marriage"}
        </button>
        <button
          onClick={() => router.push(`/correct/${person.id}`)}
          className="btn btn-quiet"
        >
          Suggest a correction
        </button>
      </div>
    </aside>
  );
}
