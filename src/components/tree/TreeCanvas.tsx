"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ControlButton,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useIsCompact } from "@/components/useIsCompact";
import { createRelationLookup, describeGenerationOffset } from "@/lib/kinship";
import { COMPACT_METRICS, DEFAULT_METRICS, layoutTree } from "@/lib/layout";
import type { TreeData } from "@/lib/tree";
import AnchorPicker from "./AnchorPicker";
import PersonNode, { type PersonFlowNode } from "./PersonNode";
import PersonDrawer from "./PersonDrawer";
import PersonSearch from "./PersonSearch";
import { useAnchor } from "./useAnchor";

const nodeTypes: NodeTypes = { person: PersonNode };

/** Everyone reachable from `starts` by following `edges` (upward or downward). */
function reachableFrom(
  starts: Iterable<string>,
  edges: Map<string, string[]>
): Set<string> {
  const found = new Set<string>(starts);
  const stack = [...found];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const nextId of edges.get(id) ?? []) {
      if (found.has(nextId)) continue;
      found.add(nextId);
      stack.push(nextId);
    }
  }
  return found;
}

export const GENERATION_COLORS = [
  "#f97316", // gen 0 — orange
  "#a855f7", // gen 1 — purple
  "#3b82f6", // gen 2 — blue
  "#22c55e", // gen 3 — green
  "#ef4444", // gen 4 — red
  "#06b6d4", // gen 5 — cyan
  "#eab308", // gen 6 — yellow
  "#ec4899", // gen 7 — pink
];

export default function TreeCanvas(props: { data: TreeData }) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function TreeCanvasInner({ data }: { data: TreeData }) {
  const { fitView } = useReactFlow();
  const isCompact = useIsCompact();
  const { anchorId, setAnchor, needsAnchor, dismiss } = useAnchor();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Person ids whose descendants are hidden (the branch is collapsed). */
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  /**
   * A person to zoom to after the next render (used by search and the anchor).
   * The sequence number lets the same person be re-focused, and lets the
   * effect below dedupe without writing state back.
   */
  const [focusRequest, setFocusRequest] = useState<{ id: string; seq: number } | null>(
    null
  );
  const handledFocusSeq = useRef(-1);
  /** The viewport is driven entirely from here, so the opening frame is ours. */
  const didInitialFit = useRef(false);
  /** Which anchor the opening collapsed view has already been built for. */
  const [seededAnchor, setSeededAnchor] = useState<string | null>(null);
  const [changingAnchor, setChangingAnchor] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const focusOn = useCallback((personId: string) => {
    setFocusRequest((prev) => ({ id: personId, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  // ---- Graph helpers over the full dataset ----
  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of data.links) {
      const list = map.get(l.parentId) ?? [];
      list.push(l.childId);
      map.set(l.parentId, list);
    }
    return map;
  }, [data.links]);

  const parentsByChild = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of data.links) {
      const list = map.get(l.childId) ?? [];
      list.push(l.parentId);
      map.set(l.childId, list);
    }
    return map;
  }, [data.links]);

  /** All descendants of each person (for the "+N" badge). */
  const descendantCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data.people) {
      let total = 0;
      const stack = [...(childrenByParent.get(p.id) ?? [])];
      const seen = new Set<string>([p.id]);
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        total++;
        stack.push(...(childrenByParent.get(id) ?? []));
      }
      counts.set(p.id, total);
    }
    return counts;
  }, [data.people, childrenByParent]);

  // ---- Anchor: relationship labels and the opening view ----
  const genderById = useMemo(
    () => new Map(data.people.map((p) => [p.id, p.gender])),
    [data.people]
  );

  // Built from the full link set, not the visible subset, so a label stays
  // correct even when the connecting branch is collapsed away.
  const relationTo = useMemo(
    () => (anchorId ? createRelationLookup(anchorId, data.links, genderById) : null),
    [anchorId, data.links, genderById]
  );

  /**
   * The anchor's spine: their descendants, plus every ancestor of anyone on
   * it. Everyone else is collapsed, so side branches still render as a card
   * but hide their subtree behind the "+N" badge.
   *
   * Collapsing is only safe for someone with no kept descendant — collapsing
   * a person hides everyone below them. That matters because an anchor who
   * married into the family has no recorded parents of their own: their line
   * upward runs through their partner, and collapsing the partner would hide
   * the anchor's own children.
   */
  const spineCollapsedIds = useMemo(() => {
    if (!anchorId) return null;
    const spine = reachableFrom([anchorId], childrenByParent);
    const keep = reachableFrom(spine, parentsByChild);
    // Someone with no recorded relatives has no spine to open on. Collapsing
    // around them would hide the entire tree and leave a row of disconnected
    // roots, so leave the view alone until they are linked to someone.
    if (keep.size <= 1) return null;
    return new Set(data.people.filter((p) => !keep.has(p.id)).map((p) => p.id));
  }, [anchorId, data.people, parentsByChild, childrenByParent]);

  // Apply the opening view once per anchor, so a later manual expand sticks.
  // Adjusting state during render (rather than in an effect) means the tree
  // never paints the whole family for a frame before collapsing it.
  if (anchorId && seededAnchor !== anchorId) {
    setSeededAnchor(anchorId);
    setCollapsedIds(spineCollapsedIds ?? new Set());
    setFocusRequest((prev) => ({ id: anchorId, seq: (prev?.seq ?? 0) + 1 }));
  }

  /** Everyone hidden because an ancestor is collapsed (descendants, not the collapsed node). */
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    const stack = [...collapsedIds];
    while (stack.length > 0) {
      const id = stack.pop()!;
      for (const childId of childrenByParent.get(id) ?? []) {
        if (!hidden.has(childId)) {
          hidden.add(childId);
          stack.push(childId);
        }
      }
    }
    return hidden;
  }, [collapsedIds, childrenByParent]);

  // Zoom to a person once the branch containing them is visible again.
  useEffect(() => {
    // Two frames: the nodes prop has just changed, and React Flow needs to
    // measure the new cards before their bounds can be framed.
    const afterLayout = (run: () => void) => {
      const outer = requestAnimationFrame(() => {
        const inner = requestAnimationFrame(run);
        frames.push(inner);
      });
      frames.push(outer);
    };
    const frames: number[] = [];

    if (focusRequest && handledFocusSeq.current !== focusRequest.seq) {
      handledFocusSeq.current = focusRequest.seq;
      didInitialFit.current = true;
      afterLayout(() =>
        fitView({
          nodes: [{ id: focusRequest.id }],
          // Enough room to see the anchor's parents and children around them,
          // but never zoomed so far out that a card stops being readable.
          padding: 0.6,
          minZoom: 0.5,
          // A little wider on a phone so the anchor arrives with their
          // parents and children around them, not filling the screen alone.
          maxZoom: isCompact ? 0.8 : 1,
          duration: 500,
        })
      );
    } else if (!didInitialFit.current) {
      // No anchor: frame the whole tree, once.
      didInitialFit.current = true;
      afterLayout(() => fitView({ padding: 0.15, maxZoom: 1.1 }));
    }

    return () => frames.forEach(cancelAnimationFrame);
  }, [focusRequest, fitView, isCompact]);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setCollapsedIds(new Set()), []);

  /** Expand every collapsed ancestor of a person so they become visible. */
  const expandAncestors = useCallback(
    (personId: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        const stack = [personId];
        const seen = new Set<string>();
        while (stack.length > 0) {
          const id = stack.pop()!;
          if (seen.has(id)) continue;
          seen.add(id);
          next.delete(id);
          stack.push(...(parentsByChild.get(id) ?? []));
        }
        return next;
      });
    },
    [parentsByChild]
  );

  // ---- Visible subset + layout (re-laid out so remaining branches reflow) ----
  const visible = useMemo(() => {
    const people = data.people.filter((p) => !hiddenIds.has(p.id));
    const links = data.links.filter(
      (l) => !hiddenIds.has(l.parentId) && !hiddenIds.has(l.childId)
    );
    return { people, links };
  }, [data, hiddenIds]);

  // Keep links from visible parents (their children may be hidden by a
  // collapsed branch — the couple must stay aligned) but drop links from
  // hidden parents, so a hidden shared spouse can't merge unrelated couples
  // into one unit. The visible set is closed under parents, so a visible
  // person's own parent links are always kept.
  const layoutLinks = useMemo(
    () => data.links.filter((l) => !hiddenIds.has(l.parentId)),
    [data.links, hiddenIds]
  );
  const metrics = isCompact ? COMPACT_METRICS : DEFAULT_METRICS;
  const layout = useMemo(
    () => layoutTree(visible.people, layoutLinks, metrics),
    [visible.people, layoutLinks, metrics]
  );

  const peopleById = useMemo(
    () => new Map(data.people.map((p) => [p.id, p])),
    [data.people]
  );

  const anchorGeneration = useMemo(() => {
    if (!anchorId) return null;
    return layout.nodes.find((n) => n.id === anchorId)?.generation ?? null;
  }, [anchorId, layout.nodes]);

  const nodes = useMemo<PersonFlowNode[]>(
    () =>
      layout.nodes.map((n) => ({
        id: n.id,
        type: "person",
        position: { x: n.x, y: n.y },
        data: {
          person: n.person,
          generationColor:
            GENERATION_COLORS[n.generation % GENERATION_COLORS.length],
          nodeWidth: metrics.nodeWidth,
          relation: relationTo?.(n.id) ?? null,
          hasChildren: (childrenByParent.get(n.id)?.length ?? 0) > 0,
          collapsed: collapsedIds.has(n.id),
          hiddenCount: descendantCount.get(n.id) ?? 0,
          onToggleCollapse: toggleCollapse,
        },
        draggable: false,
      })),
    [
      layout,
      collapsedIds,
      childrenByParent,
      descendantCount,
      toggleCollapse,
      relationTo,
      metrics.nodeWidth,
    ]
  );

  const edges = useMemo<Edge[]>(
    () =>
      layout.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "#3f4b5e", strokeWidth: 1.5 },
        interactionWidth: 24,
      })),
    [layout]
  );

  // Derived, not cleaned up in an effect: collapsing a branch that contains
  // the open person closes the drawer on the same render.
  const selected =
    selectedId && !hiddenIds.has(selectedId) ? peopleById.get(selectedId) : undefined;
  const selectedParents = selected
    ? data.links
        .filter((l) => l.childId === selected.id)
        .map((l) => peopleById.get(l.parentId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
    : [];
  const selectedChildren = selected
    ? data.links
        .filter((l) => l.parentId === selected.id)
        .map((l) => peopleById.get(l.childId))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
    : [];

  const hasCollapsed = collapsedIds.size > 0;
  const anchorPerson = anchorId ? peopleById.get(anchorId) : undefined;

  const pickAnchor = useCallback(
    (personId: string) => {
      setAnchor(personId);
      setChangingAnchor(false);
    },
    [setAnchor]
  );

  return (
    <div className="relative h-full w-full">
      <PersonSearch
        onSelect={(personId) => {
          expandAncestors(personId);
          setSelectedId(personId);
          focusOn(personId);
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        minZoom={0.05}
        maxZoom={2}
        nodesConnectable={false}
        onNodeClick={(_, node) => setSelectedId(node.id)}
        onPaneClick={() => setSelectedId(null)}
        className="bg-[#0d1117]"
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#21262d"
        />
        <Controls
          position="bottom-left"
          showInteractive={false}
          className="!bg-[#161b22] !border-gray-700 [&>button]:!h-11 [&>button]:!w-11 [&>button]:!bg-[#161b22] [&>button]:!text-gray-300 [&>button]:!border-gray-700 sm:[&>button]:!h-7 sm:[&>button]:!w-7"
        >
          {hasCollapsed && (
            <ControlButton
              onClick={expandAll}
              title="Expand all branches"
              aria-label="Expand all branches"
              className="text-sm font-bold"
            >
              ⤢
            </ControlButton>
          )}
        </Controls>
        {/* A minimap of 2mm nodes helps nobody on a phone, and it eats a corner. */}
        {!isCompact && (
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            className="!bg-[#161b22] !border-gray-700"
            nodeColor={(node) =>
              (node.data as { generationColor?: string }).generationColor ?? "#3f4b5e"
            }
          />
        )}
      </ReactFlow>

      {/* Anchor state + generation legend. On a phone these sit bottom-right,
          clear of both the search bar and the zoom controls, so they never
          cover the cards; on wider screens they return to the top left. */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2 sm:bottom-auto sm:left-4 sm:right-auto sm:top-20 sm:flex-row sm:items-start">
        {anchorPerson ? (
          <button
            type="button"
            onClick={() => setChangingAnchor(true)}
            className="pointer-events-auto flex min-h-9 max-w-[70vw] items-center gap-1.5 rounded-full border border-[#58a6ff]/40 bg-[#0d1117]/90 px-3 py-1.5 text-xs text-[#79c0ff] backdrop-blur sm:max-w-none"
          >
            <span className="truncate">
              Viewing as {anchorPerson.firstName} {anchorPerson.lastName}
            </span>
            <span className="shrink-0 text-gray-500">change</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setChangingAnchor(true)}
            className="pointer-events-auto min-h-9 rounded-full border border-gray-700 bg-[#0d1117]/90 px-3 py-1.5 text-xs text-gray-300 backdrop-blur"
          >
            Find yourself
          </button>
        )}

        {hasCollapsed && (
          <button
            type="button"
            onClick={() => {
              expandAll();
              setFocusRequest(null);
              didInitialFit.current = false;
            }}
            className="pointer-events-auto min-h-9 rounded-full border border-gray-700 bg-[#0d1117]/90 px-3 py-1.5 text-xs text-gray-300 backdrop-blur"
          >
            Show everyone
          </button>
        )}

        <div className="pointer-events-auto rounded-xl border border-gray-800 bg-[#0d1117]/90 backdrop-blur">
          <button
            type="button"
            onClick={() => setLegendOpen((open) => !open)}
            aria-expanded={legendOpen}
            className="flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400"
          >
            Generations
            <span className="text-gray-600">{legendOpen ? "−" : "+"}</span>
          </button>
          {legendOpen && (
            <div className="space-y-1.5 border-t border-gray-800 px-3 py-2">
              {Array.from({ length: layout.maxGeneration + 1 }, (_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{
                      backgroundColor: GENERATION_COLORS[i % GENERATION_COLORS.length],
                    }}
                  />
                  <span className="text-xs text-gray-300">
                    {anchorGeneration === null
                      ? `Generation ${i}`
                      : describeGenerationOffset(i - anchorGeneration)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <PersonDrawer
          person={selected}
          parents={selectedParents}
          childPeople={selectedChildren}
          relation={relationTo?.(selected.id) ?? null}
          onClose={() => setSelectedId(null)}
        />
      )}

      {(needsAnchor || changingAnchor) && (
        <AnchorPicker
          mode={changingAnchor && anchorId ? "change" : "first-visit"}
          onPick={pickAnchor}
          onDismiss={() => {
            setChangingAnchor(false);
            if (needsAnchor) dismiss();
          }}
        />
      )}
    </div>
  );
}
