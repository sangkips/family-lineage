"use client";

import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GENERATION_LABELS, layoutTree } from "@/lib/layout";
import type { TreeData } from "@/lib/tree";
import PersonNode, { type PersonFlowNode } from "./PersonNode";
import PersonDrawer from "./PersonDrawer";

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

export default function TreeCanvas({ data }: { data: TreeData }) {
  const layout = useMemo(() => layoutTree(data.people, data.links), [data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
        },
        draggable: false,
      })),
    [layout]
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

  return (
    <div className="relative h-full w-full">
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
        />
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
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
