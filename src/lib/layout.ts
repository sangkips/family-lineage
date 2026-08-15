import type { ParentLinkDTO, PersonDTO } from "./tree";

// ---- Output types ----

export type TreeNode = {
  id: string;
  x: number;
  y: number;
  generation: number;
  person: PersonDTO;
};

export type TreeEdge = {
  id: string;
  source: string;
  target: string;
};

export type LayoutResult = {
  nodes: TreeNode[];
  edges: TreeEdge[];
  maxGeneration: number;
};

// ---- Constants ----

export const NODE_WIDTH = 200;
export const NODE_HEIGHT = 78;
/** Narrower cards on a phone, where 200px is half the screen. */
export const NODE_WIDTH_COMPACT = 156;
const NODE_H_GAP = 28; // gap between adjacent nodes in the same row
const NODE_H_GAP_COMPACT = 18;
const ROW_HEIGHT = 150; // vertical gap between generations
const ROW_HEIGHT_COMPACT = 128;

/** Pixel metrics for a layout pass — mobile uses the compact set. */
export type LayoutMetrics = {
  nodeWidth: number;
  nodeGap: number;
  rowHeight: number;
};

export const DEFAULT_METRICS: LayoutMetrics = {
  nodeWidth: NODE_WIDTH,
  nodeGap: NODE_H_GAP,
  rowHeight: ROW_HEIGHT,
};

export const COMPACT_METRICS: LayoutMetrics = {
  nodeWidth: NODE_WIDTH_COMPACT,
  nodeGap: NODE_H_GAP_COMPACT,
  rowHeight: ROW_HEIGHT_COMPACT,
};

// ---- Algorithm ----
//
// A real family tree is a directed acyclic graph (≤2 parents per person).
// We lay it out as a tidy tree of *couple units*:
//
//   1. Generation per person: longest path from the parents, except spouses
//      with unknown parents adopt their partner's generation.
//   2. Units: maximal sets of people connected by co-parenting (a couple).
//   3. Subtree width per unit (bottom-up), counting each child unit once via
//      its "primary" parent (the deepest one) to avoid double counting.
//   4. Top-down placement: each unit gets a slot range; its children units are
//      centered under it.

type Unit = {
  members: PersonDTO[];
  generation: number;
  parentUnits: Unit[];
  childUnits: Unit[];
  subtreeWidth: number;
  slotX: number;
};

export function layoutTree(
  people: PersonDTO[],
  links: ParentLinkDTO[],
  metrics: LayoutMetrics = DEFAULT_METRICS
): LayoutResult {
  const byId = new Map(people.map((p) => [p.id, p]));

  const parentsByChild = new Map<string, string[]>();
  const childrenByParent = new Map<string, string[]>();
  for (const l of links) {
    push(parentsByChild, l.childId, l.parentId);
    push(childrenByParent, l.parentId, l.childId);
  }

  // Spouses = people who co-parent at least one child.
  const spouseOf = new Map<string, string[]>();
  for (const parents of parentsByChild.values()) {
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        push(spouseOf, parents[i], parents[j]);
        push(spouseOf, parents[j], parents[i]);
      }
    }
  }

  // ---- 1. Generations (cycle-guarded memoized DFS) ----
  const genMemo = new Map<string, number>();
  const visiting = new Set<string>();

  function generationOf(personId: string): number {
    if (genMemo.has(personId)) return genMemo.get(personId)!;
    if (visiting.has(personId)) return 0; // data cycle guard
    visiting.add(personId);

    const parents = parentsByChild.get(personId) ?? [];
    let gen: number;
    if (parents.length === 0) {
      // Unknown parents: adopt a partner's generation if they have parents,
      // so spouses render on the same row instead of becoming fake roots.
      const partnerGens = (spouseOf.get(personId) ?? [])
        .map((s) => generationOf(s))
        .filter((g) => g > 0);
      gen = partnerGens.length ? Math.max(...partnerGens) : 0;
    } else {
      gen = Math.max(...parents.map((p) => generationOf(p))) + 1;
    }

    visiting.delete(personId);
    genMemo.set(personId, gen);
    return gen;
  }

  // ---- 2. Couple units (union-find over spouse links) ----
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const root = parent.get(x) ?? x;
    if (root !== x) parent.set(x, find(root));
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const [a, partners] of spouseOf) for (const b of partners) union(a, b);

  const unitOfMember = new Map<string, Unit>();
  const units: Unit[] = [];
  for (const p of people) {
    const root = find(p.id);
    let unit = unitOfMember.get(root);
    if (!unit) {
      unit = {
        members: [],
        generation: 0,
        parentUnits: [],
        childUnits: [],
        subtreeWidth: 0,
        slotX: 0,
      };
      unitOfMember.set(root, unit);
      units.push(unit);
    }
    unit.members.push(p);
  }
  for (const u of units) {
    u.generation = Math.max(...u.members.map((m) => generationOf(m.id)));
    u.members.sort((a, b) =>
      a.gender === "FEMALE" ? 1 : b.gender === "FEMALE" ? -1 : 0
    );
  }

  // ---- 3. Unit parent/child relationships ----
  for (const u of units) {
    for (const m of u.members) {
      for (const childId of childrenByParent.get(m.id) ?? []) {
        const childUnit = unitOfMember.get(find(childId));
        if (childUnit && childUnit !== u && !childUnit.parentUnits.includes(u)) {
          childUnit.parentUnits.push(u);
        }
      }
    }
  }
  for (const u of units) {
    for (const p of u.parentUnits) p.childUnits.push(u);
  }

  // ---- 4. Subtree widths (bottom-up) ----
  // Each child unit is owned by its "primary" parent (the deepest one) so its
  // width is counted exactly once even with remarriage / two families.
  const primaryParent = new Map<Unit, Unit>();
  for (const u of units) {
    if (u.parentUnits.length === 0) continue;
    u.parentUnits.sort((a, b) => b.generation - a.generation);
    primaryParent.set(u, u.parentUnits[0]);
  }

  const widthMemo = new Map<Unit, number>();
  function subtreeWidth(u: Unit): number {
    if (widthMemo.has(u)) return widthMemo.get(u)!;
    const ownedChildren = u.childUnits.filter((c) => primaryParent.get(c) === u);
    const total =
      ownedChildren.length === 0
        ? 1
        : ownedChildren.reduce((sum, c) => sum + subtreeWidth(c), 0);
    widthMemo.set(u, total);
    return total;
  }

  // ---- 5. Top-down placement ----
  function place(u: Unit, leftSlot: number) {
    u.slotX = leftSlot;
    const ownedChildren = u.childUnits.filter((c) => primaryParent.get(c) === u);
    const childrenWidth = ownedChildren.reduce((s, c) => s + subtreeWidth(c), 0);
    let cursor = leftSlot + Math.max(0, (subtreeWidth(u) - childrenWidth) / 2);
    for (const c of ownedChildren) {
      place(c, cursor);
      cursor += subtreeWidth(c);
    }
  }

  const roots = units
    .filter((u) => u.parentUnits.length === 0)
    .sort((a, b) => a.generation - b.generation);
  let cursor = 0;
  for (const r of roots) {
    place(r, cursor);
    cursor += subtreeWidth(r) + 1;
  }

  // ---- 6. Pixels ----
  // Couple members sit side by side, one full slot apart (like roadmap.sh cards).
  const slotWidth = metrics.nodeWidth + metrics.nodeGap;
  const nodes: TreeNode[] = [];
  for (const u of units) {
    u.members.forEach((m, i) => {
      nodes.push({
        id: m.id,
        x: u.slotX * slotWidth + i * slotWidth,
        y: u.generation * metrics.rowHeight,
        generation: u.generation,
        person: byId.get(m.id)!,
      });
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  const edges: TreeEdge[] = [];
  const seen = new Set<string>();
  for (const l of links) {
    if (!nodeIds.has(l.childId) || !nodeIds.has(l.parentId)) continue;
    const id = `${l.parentId}->${l.childId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    edges.push({ id, source: l.parentId, target: l.childId });
  }

  return {
    nodes,
    edges,
    maxGeneration: Math.max(0, ...units.map((u) => u.generation)),
  };
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
