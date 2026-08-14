import type { ParentRole, TreeData } from "./tree";

/**
 * GEDCOM 5.5.1 (LINEAGE-LINKED) export.
 *
 * Turns a `TreeData` snapshot (already privacy-redacted by `getTree`) into a
 * standard `.ged` file readable by genealogy software (Gramps, Ancestry,
 * FamilySearch, etc.). Uses one INDI record per person and one FAM record per
 * unique set of parents (siblings are grouped under the same family).
 */

const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

const SEX_MAP: Record<string, string> = {
  MALE: "M",
  FEMALE: "F",
  OTHER: "U",
};

/** GEDCOM xrefs must be alphanumeric — strip anything else from ids. */
function xrefId(prefix: string, id: string): string {
  return `@${prefix}${id.replace(/[^A-Za-z0-9]/g, "")}@`;
}

/** A literal `@` is escaped by doubling it in GEDCOM values. */
function esc(value: string): string {
  return value.replace(/@/g, "@@").replace(/\r/g, "");
}

/** "2026-08-14T00:00:00.000Z" → "14 AUG 2026". */
function gedcomDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Names in GEDCOM are "Given /Surname/"; slash in a given name would break it. */
function gedcomName(given: string, surname: string): string {
  const g = given.replace(/\//g, "-");
  return surname ? `${g} /${surname}/` : g;
}

function pushNote(lines: string[], level: number, value: string | null | undefined): void {
  if (!value) return;
  const text = esc(value);
  const first = text.split("\n")[0];
  lines.push(`${level} NOTE ${first}`);
  // Long notes: GEDCOM lines should stay under 255 chars and newlines become CONT.
  for (const chunk of text.slice(first.length).split("\n")) {
    if (!chunk) {
      lines.push(`${level} CONT`);
    } else if (chunk.length <= 240) {
      lines.push(`${level} CONT ${chunk}`);
    } else {
      let remaining = chunk;
      while (remaining.length > 240) {
        lines.push(`${level} CONT ${remaining.slice(0, 240)}`);
        remaining = remaining.slice(240);
      }
      lines.push(`${level} CONT ${remaining}`);
    }
  }
}

/**
 * Build a complete GEDCOM 5.5.1 document from tree data.
 * The tree is expected to already be filtered/redacted for the requesting
 * viewer, so the export never leaks anything the tree UI wouldn't show.
 */
export function buildGedcom(tree: TreeData): string {
  const lines: string[] = [];

  // ---- Header ----
  lines.push("0 HEAD");
  lines.push("1 GEDC");
  lines.push("2 VERS 5.5.1");
  lines.push("2 FORM LINEAGE-LINKED");
  lines.push("1 CHAR UTF-8");
  lines.push("1 SOUR Family Tree");
  lines.push("1 DATE " + gedcomDate(new Date().toISOString()));

  const people = new Map(tree.people.map((p) => [p.id, p]));
  const personXref = new Map<string, string>();
  tree.people.forEach((p, i) => personXref.set(p.id, xrefId("I", p.id || String(i + 1))));

  // ---- Individuals ----
  for (const person of tree.people) {
    const xref = personXref.get(person.id)!;
    lines.push(`0 ${xref} INDI`);
    lines.push(`1 NAME ${gedcomName(esc(person.firstName), esc(person.lastName))}`);

    // Maiden name as an alternate name when it differs from the surname.
    if (person.maidenName && person.maidenName !== person.lastName) {
      lines.push(`1 NAME ${gedcomName(esc(person.firstName), esc(person.maidenName))}`);
      lines.push("2 TYPE maiden");
    }

    if (person.gender) {
      lines.push(`1 SEX ${SEX_MAP[person.gender] ?? "U"}`);
    }
    if (person.birthDate) {
      lines.push("1 BIRT");
      lines.push(`2 DATE ${gedcomDate(person.birthDate)}`);
      if (person.birthPlace) lines.push(`2 PLAC ${esc(person.birthPlace)}`);
    }
    if (person.deathDate) {
      lines.push("1 DEAT");
      lines.push(`2 DATE ${gedcomDate(person.deathDate)}`);
    }
    pushNote(lines, 1, person.bio);

    // Parent family references (added after families are numbered below).
    lines.push(`1 FAMC @${person.id}@`); // placeholder, replaced later
  }

  // ---- Families: group children by their sorted set of parents ----
  type Family = { parents: string[]; children: string[] };
  const families = new Map<string, Family>();

  // Group by child first: child → sorted parent ids
  const parentsByChild = new Map<string, string[]>();
  for (const link of tree.links) {
    const list = parentsByChild.get(link.childId) ?? [];
    list.push(link.parentId);
    parentsByChild.set(link.childId, list);
  }

  for (const [childId, parentIds] of parentsByChild) {
    const uniqueParents = [...new Set(parentIds)].sort();
    const key = uniqueParents.join("|");
    const family = families.get(key) ?? { parents: uniqueParents, children: [] };
    family.children.push(childId);
    families.set(key, family);
  }

  // Build xrefs for families and rewrite the FAMC placeholders.
  const familyXref = new Map<string, string>();
  [...families.keys()].forEach((key, i) => familyXref.set(key, xrefId("F", String(i + 1))));

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("1 FAMC @")) {
      const personId = lines[i].slice("1 FAMC @".length, -1);
      const parentIds = parentsByChild.get(personId);
      if (parentIds && parentIds.length > 0) {
        const fref = familyXref.get([...new Set(parentIds)].sort().join("|"));
        lines[i] = `1 FAMC ${fref}`;
      } else {
        lines.splice(i, 1);
        i--; // don't skip the next line after removal
      }
    }
  }

  for (const [key, family] of families) {
    const xref = familyXref.get(key)!;
    lines.push(`0 ${xref} FAM`);
    const roleFor = (parentId: string): ParentRole | null => {
      const link = tree.links.find((l) => l.parentId === parentId && family.children.includes(l.childId));
      return link?.role ?? null;
    };
    for (const parentId of family.parents) {
      const role = roleFor(parentId);
      const tag = role === "MOTHER" ? "WIFE" : role === "FATHER" || role === "PARENT" || !role ? "HUSB" : "ASSO";
      lines.push(`1 ${tag} ${personXref.get(parentId)}`);
    }
    for (const childId of family.children) {
      lines.push(`1 CHIL ${personXref.get(childId)}`);
    }
  }

  lines.push("0 TRLR");
  return lines.join("\n") + "\n";
}
