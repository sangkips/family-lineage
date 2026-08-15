import type { DatePrecision, PersonDTO } from "./tree";

/**
 * Register shorthand for a lifespan: "b. 1938" while living, "1901–1974"
 * once closed. Shared by the tree cards and the entry drawer so a person
 * reads the same wherever they appear.
 */
export function formatYears(person: PersonDTO): string {
  const birth = person.birthDate
    ? String(new Date(person.birthDate).getFullYear())
    : null;

  if (person.isLiving) return birth ? `b. ${birth}` : "living";
  if (person.deathDate) {
    const death = new Date(person.deathDate).getFullYear();
    return birth ? `${birth}–${death}` : `d. ${death}`;
  }
  return birth ? `${birth}–?` : "dates unrecorded";
}

/**
 * A date as a register would print it, showing only what was actually known.
 *
 * Most ancestors are remembered by year alone, so a `YEAR` date prints "1948"
 * rather than "1 January 1948" — the stored day and month are filler, and
 * printing them would invent a precision nobody supplied.
 */
export function formatFullDate(
  iso: string | null,
  precision: DatePrecision = "DAY"
): string {
  if (!iso) return "unrecorded";
  const date = new Date(iso);

  if (precision === "YEAR") return String(date.getUTCFullYear());
  if (precision === "MONTH") {
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
