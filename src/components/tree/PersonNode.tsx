import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { formatYears } from "@/lib/person-format";
import { NODE_WIDTH } from "@/lib/layout";
import type { PersonDTO } from "@/lib/tree";

export type PersonNodeData = {
  person: PersonDTO;
  generationColor: string;
  /** Card width in px — narrower on phones, kept in step with the layout pass. */
  nodeWidth?: number;
  /** How this person relates to the anchor ("your grandmother"), if anchored. */
  relation?: string | null;
  /** Whether this person has children (shows the collapse toggle). */
  hasChildren?: boolean;
  /** Whether this person's branch is currently collapsed. */
  collapsed?: boolean;
  /** How many descendants are hidden while collapsed (the "+N" badge). */
  hiddenCount?: number;
  onToggleCollapse?: (personId: string) => void;
};

export type PersonFlowNode = Node<PersonNodeData, "person">;

function PersonNode({ data, selected }: NodeProps<PersonFlowNode>) {
  const {
    person,
    generationColor,
    nodeWidth = NODE_WIDTH,
    relation,
    hasChildren,
    collapsed,
    hiddenCount = 0,
    onToggleCollapse,
  } = data;
  const isPending = person.status === "PENDING";
  const isAnchor = relation === "you";
  const initials = `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();

  const avatarStyles =
    person.gender === "FEMALE"
      ? "bg-pink-500/20 text-pink-300 border-pink-500/50"
      : person.gender === "MALE"
        ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
        : "bg-purple-500/20 text-purple-300 border-purple-500/50";

  return (
    <div
      style={{ width: nodeWidth, borderTop: `3px solid ${isPending ? "#f59e0b" : generationColor}` }}
      className={`relative rounded-xl border bg-[#161b22] shadow-lg transition-shadow ${
        selected
          ? "border-[#58a6ff] ring-2 ring-[#58a6ff]/40"
          : isAnchor
            ? "border-[#58a6ff]/70 ring-1 ring-[#58a6ff]/30"
            : isPending
              ? "border-dashed border-amber-500/60"
              : "border-gray-700/80"
      } ${isPending ? "opacity-80" : ""}`}
    >
      {hasChildren && onToggleCollapse && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(person.id);
          }}
          title={
            collapsed
              ? `Expand ${person.firstName}'s branch (${hiddenCount} hidden)`
              : `Collapse ${person.firstName}'s branch`
          }
          aria-label={
            collapsed
              ? `Expand ${person.firstName}'s branch`
              : `Collapse ${person.firstName}'s branch`
          }
          // The visible pill stays small; ::after widens the hit area to a
          // thumb-sized target without disturbing the layout.
          className={`absolute -right-2.5 -top-2.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-xs font-semibold shadow-md transition-colors after:absolute after:-inset-2.5 after:content-[''] ${
            collapsed
              ? "border-[#58a6ff] bg-[#58a6ff] text-[#0d1117] hover:bg-[#79c0ff]"
              : "border-gray-600 bg-[#0d1117] text-gray-300 hover:border-[#58a6ff] hover:text-[#58a6ff]"
          }`}
        >
          {collapsed ? `+${hiddenCount}` : "−"}
        </button>
      )}

      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />
      {/* Side handles carry the spouse connector between partners. */}
      <Handle
        id="spouse-left"
        type="target"
        position={Position.Left}
        className="!h-1.5 !w-1.5 !border-0 !bg-transparent"
      />
      <Handle
        id="spouse-right"
        type="source"
        position={Position.Right}
        className="!h-1.5 !w-1.5 !border-0 !bg-transparent"
      />

      <div className="flex items-center gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3 sm:py-2.5">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold sm:h-9 sm:w-9 ${avatarStyles}`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          {/* Wraps rather than truncates — a card that says "Sarah Ander…"
              is not much use for finding your own family. */}
          <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-gray-100 sm:text-sm">
            {person.firstName} {person.lastName}
          </p>
          <p className="truncate text-[11px] text-gray-400 sm:text-xs">
            {isPending ? (
              <span className="flex items-center gap-1 text-amber-400">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                Pending approval
              </span>
            ) : (
              formatYears(person)
            )}
          </p>
        </div>
      </div>

      {relation && (
        <p
          className={`truncate rounded-b-[9px] border-t px-2.5 py-1 text-[11px] ${
            isAnchor
              ? "border-[#58a6ff]/30 bg-[#58a6ff]/10 font-semibold text-[#79c0ff]"
              : "border-gray-800 bg-[#0d1117]/60 text-gray-400"
          }`}
        >
          {relation}
        </p>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2" />
    </div>
  );
}

export default memo(PersonNode);
