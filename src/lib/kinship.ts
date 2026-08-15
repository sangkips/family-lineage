import type { Gender, ParentLinkDTO } from "./tree";

/**
 * Relationship labels relative to an anchor person ("your grandmother",
 * "your cousin") so the tree reads as a story about someone rather than a
 * wall of strangers.
 *
 * Deliberately covers only the terms families actually use — the lineal
 * ladder, siblings, aunts/uncles, nieces/nephews and first cousins — and
 * degrades to an honest "relative · 2 generations up" beyond that rather
 * than guessing at "second cousin once removed".
 */

type ParentsByChild = ReadonlyMap<string, string[]>;

/** Distance from a person up to each of their ancestors (self = 0). */
function ancestorDepths(
  personId: string,
  parentsByChild: ParentsByChild
): Map<string, number> {
  // Breadth-first so the first depth recorded for an ancestor is the nearest
  // one — a person can be reachable through both parents at different depths.
  const depths = new Map<string, number>([[personId, 0]]);
  let frontier = [personId];
  let depth = 0;

  while (frontier.length > 0) {
    depth++;
    const next: string[] = [];
    for (const id of frontier) {
      for (const parentId of parentsByChild.get(id) ?? []) {
        if (depths.has(parentId)) continue;
        depths.set(parentId, depth);
        next.push(parentId);
      }
    }
    frontier = next;
  }

  return depths;
}

function byGender(
  gender: Gender | null | undefined,
  male: string,
  female: string,
  neutral: string
): string {
  if (gender === "MALE") return male;
  if (gender === "FEMALE") return female;
  return neutral;
}

const GREATS = ["", "great-", "great-great-"];

/** "parent" → "grandparent" → "great-grandparent" for a lineal ancestor. */
function ancestorTerm(depth: number, gender: Gender | null | undefined): string | null {
  if (depth === 1) return byGender(gender, "father", "mother", "parent");
  const greats = GREATS[depth - 2];
  if (greats === undefined) return null;
  return greats + byGender(gender, "grandfather", "grandmother", "grandparent");
}

/** "child" → "grandchild" → "great-grandchild" for a lineal descendant. */
function descendantTerm(depth: number, gender: Gender | null | undefined): string | null {
  if (depth === 1) return byGender(gender, "son", "daughter", "child");
  const greats = GREATS[depth - 2];
  if (greats === undefined) return null;
  return greats + byGender(gender, "grandson", "granddaughter", "grandchild");
}

function generationsAway(steps: number, direction: "up" | "down"): string {
  const plural = steps === 1 ? "" : "s";
  return `relative · ${steps} generation${plural} ${direction}`;
}

const GENERATION_UP = ["Your generation", "Parents", "Grandparents", "Great-grandparents"];
const GENERATION_DOWN = ["Your generation", "Children", "Grandchildren", "Great-grandchildren"];

/**
 * Label a whole generation row relative to the anchor's own row: -1 is the
 * parents' row, +2 the grandchildren's. Used by the tree legend, which
 * describes rows rather than individual people.
 */
export function describeGenerationOffset(offset: number): string {
  const table = offset < 0 ? GENERATION_UP : GENERATION_DOWN;
  const label = table[Math.abs(offset)];
  if (label) return label;
  return generationsAway(Math.abs(offset), offset < 0 ? "up" : "down");
}

export type RelationLookup = (targetId: string) => string | null;

/**
 * Build a lookup describing everyone's relationship to `anchorId`.
 *
 * The anchor's own ancestor set is computed once and shared across every
 * call, so labelling a whole tree stays linear in the number of cards.
 * Returns `null` for people with no common ancestor — they share the tree
 * by marriage, not by blood, and inventing a term for them would be a lie.
 */
export function createRelationLookup(
  anchorId: string,
  links: readonly ParentLinkDTO[],
  genderById?: ReadonlyMap<string, Gender | null>
): RelationLookup {
  const parentsByChild = new Map<string, string[]>();
  for (const link of links) {
    const list = parentsByChild.get(link.childId);
    if (list) list.push(link.parentId);
    else parentsByChild.set(link.childId, [link.parentId]);
  }

  const anchorAncestors = ancestorDepths(anchorId, parentsByChild);

  return (targetId: string): string | null => {
    if (targetId === anchorId) return "you";

    const genderOf = (id: string) => genderById?.get(id) ?? null;

    // The target is one of the anchor's ancestors.
    const upward = anchorAncestors.get(targetId);
    if (upward !== undefined) {
      return ancestorTerm(upward, genderOf(targetId)) ?? generationsAway(upward, "up");
    }

    const targetAncestors = ancestorDepths(targetId, parentsByChild);

    // The anchor is one of the target's ancestors.
    const downward = targetAncestors.get(anchorId);
    if (downward !== undefined) {
      return descendantTerm(downward, genderOf(targetId)) ?? generationsAway(downward, "down");
    }

    // Neither is descended from the other: find the nearest common ancestor,
    // the one minimising the combined walk from both people.
    let bestSum = Infinity;
    let fromAnchor = 0;
    let fromTarget = 0;
    for (const [ancestorId, targetDepth] of targetAncestors) {
      const anchorDepth = anchorAncestors.get(ancestorId);
      if (anchorDepth === undefined) continue;
      if (anchorDepth + targetDepth < bestSum) {
        bestSum = anchorDepth + targetDepth;
        fromAnchor = anchorDepth;
        fromTarget = targetDepth;
      }
    }

    if (bestSum === Infinity) return null; // no blood relation

    const gender = genderOf(targetId);
    if (fromAnchor === 1 && fromTarget === 1) {
      return byGender(gender, "brother", "sister", "sibling");
    }
    if (fromAnchor === 2 && fromTarget === 1) {
      return byGender(gender, "uncle", "aunt", "aunt or uncle");
    }
    if (fromAnchor === 1 && fromTarget === 2) {
      return byGender(gender, "nephew", "niece", "niece or nephew");
    }
    if (fromAnchor === 2 && fromTarget === 2) {
      return "cousin";
    }

    const difference = fromTarget - fromAnchor;
    if (difference === 0) return "relative · same generation";
    return generationsAway(Math.abs(difference), difference > 0 ? "down" : "up");
  };
}

/** Single-pair convenience wrapper — mostly for tests and one-off labels. */
export function describeRelation(
  anchorId: string,
  targetId: string,
  links: readonly ParentLinkDTO[],
  genderById?: ReadonlyMap<string, Gender | null>
): string | null {
  return createRelationLookup(anchorId, links, genderById)(targetId);
}
