"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { GENERATION_LABELS, layoutTree } from "@/lib/layout";
import type { TreeData } from "@/lib/tree";
import PersonNode, { type PersonFlowNode } from "./PersonNode";
import PersonDrawer from "./PersonDrawer";
import PersonSearch from "./PersonSearch";

const nodeTypes: NodeTypes = { person: PersonNode };

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

export default function TreeCanvas(props: {
  data: TreeData;
  /** The viewer's own claimed node, if any — enables "Edit your profile". */
  viewerPersonId?: string | null;
}) {
  return (
    <ReactFlowProvider>
      <TreeCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function TreeCanvasInner({
  data,
  viewerPersonId = null,
}: {
  data: TreeData;
  viewerPersonId?: string | null;
}) {
  const { fitView } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Person ids whose descendants are hidden (the branch is collapsed). */
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  /** A person to zoom to after the next render (used by search). */
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

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

  // Close the drawer if the selected person becomes hidden by a collapse.
  useEffect(() => {
    if (selectedId && hiddenIds.has(selectedId)) setSelectedId(null);
  }, [selectedId, hiddenIds]);

  // Zoom to a person once the branch containing them is visible again.
  useEffect(() => {
    if (!pendingFocusId) return;
    fitView({ nodes: [{ id: pendingFocusId }], padding: 0.4, duration: 500 });
    setPendingFocusId(null);
  }, [pendingFocusId, fitView]);

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
  const layout = useMemo(
    () => layoutTree(visible.people, layoutLinks),
    [visible.people, layoutLinks]
  );

  const peopleById = useMemo(
    () => new Map(data.people.map((p) => [p.id, p])),
    [data.people]
  );

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
          hasChildren: (childrenByParent.get(n.id)?.length ?? 0) > 0,
          collapsed: collapsedIds.has(n.id),
          hiddenCount: descendantCount.get(n.id) ?? 0,
          onToggleCollapse: toggleCollapse,
        },
        draggable: false,
      })),
    [layout, collapsedIds, childrenByParent, descendantCount, toggleCollapse]
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

  const selected = selectedId ? peopleById.get(selectedId) : undefined;
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

  return (
    <div className="relative h-full w-full">
      <PersonSearch
        onSelect={(personId) => {
          expandAncestors(personId);
          setSelectedId(personId);
          setPendingFocusId(personId);
        }}
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
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
          className="!bg-[#161b22] !border-gray-700 [&>button]:!bg-[#161b22] [&>button]:!text-gray-300 [&>button]:!border-gray-700"
        >
          {hasCollapsed && (
            <ControlButton
              onClick={expandAll}
              title="Expand all branches"
              aria-label="Expand all branches"
              className="!w-7 !h-7 text-sm font-bold"
            >
              ⤢
            </ControlButton>
          )}
        </Controls>
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          className="!bg-[#161b22] !border-gray-700"
          nodeColor={(node) =>
            (node.data as { generationColor?: string }).generationColor ??
            "#3f4b5e"
          }
        />
      </ReactFlow>

      {/* Generation legend */}
      <div className="pointer-events-none absolute left-4 top-4 z-10 space-y-1.5 rounded-xl border border-gray-800 bg-[#0d1117]/85 p-3 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Generations
        </p>
        {Array.from({ length: layout.maxGeneration + 1 }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{
                backgroundColor:
                  GENERATION_COLORS[i % GENERATION_COLORS.length],
              }}
            />
            <span className="text-xs text-gray-300">
              {GENERATION_LABELS[i] ?? `Generation ${i}`}
            </span>
          </div>
        ))}
      </div>

      {selected && (
        <PersonDrawer
          person={selected}
          parents={selectedParents}
          children={selectedChildren}
          ownPersonId={viewerPersonId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
