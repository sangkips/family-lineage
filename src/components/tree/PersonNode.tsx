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

  // Two colours do the whole cloth, so gender is cobalt, hibiscus, or ink —
  // never a third decorative hue.
  const avatarStyles = isAnchor
    ? "border-white/40 bg-white/15 text-white"
    : person.gender === "FEMALE"
      ? "border-hibiscus/40 bg-hibiscus-wash text-hibiscus"
      : person.gender === "MALE"
        ? "border-cobalt/30 bg-cobalt-wash text-cobalt"
        : "border-seam bg-field text-ink-soft";

  return (
    <div
      style={{
        width: nodeWidth,
        borderTop: `3px solid ${isPending ? "var(--color-ochre)" : generationColor}`,
      }}
      // The anchor is the one filled card on the cloth: everyone else is paper.
      className={`relative rounded-[14px] border transition-shadow ${
        isAnchor
          ? "border-hibiscus bg-cobalt shadow-[0_10px_24px_-14px_rgb(16_26_46/0.6)]"
          : isPending
            ? "border-dashed border-ochre bg-ochre-wash"
            : "border-seam bg-card"
      } ${selected ? "ring-2 ring-cobalt" : ""}`}
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
          className={`tnum absolute -right-2.5 -top-2.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-full border px-1 text-xs font-semibold shadow-sm transition-colors after:absolute after:-inset-2.5 after:content-[''] ${
            collapsed
              ? "border-cobalt bg-cobalt text-white hover:bg-cobalt-deep"
              : "border-seam bg-card text-ink-soft hover:border-cobalt hover:text-cobalt"
          }`}
        >
          {collapsed ? `+${hiddenCount}` : "−"}
        </button>
      )}

      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-[#b9c2cc]" />
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
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-display text-xs font-bold sm:h-9 sm:w-9 ${avatarStyles}`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          {/* Wraps rather than truncates — a card that says "Sarah Ander…"
              is not much use for finding your own family. */}
          <p
            className={`line-clamp-2 font-display text-[13px] font-bold leading-tight sm:text-sm ${
              isAnchor ? "text-white" : "text-ink"
            }`}
          >
            {person.firstName} {person.lastName}
          </p>
          <p
            className={`tnum truncate text-[11px] sm:text-xs ${
              isAnchor ? "text-white/70" : "text-ink-soft"
            }`}
          >
            {isPending ? (
              <span className="flex items-center gap-1 text-ochre-ink">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-ochre" />
                Pending approval
              </span>
            ) : (
              formatYears(person)
            )}
          </p>
        </div>
      </div>

      {/* The card's own hem: how this person stands to you. */}
      {relation && (
        <p
          className={`truncate rounded-b-[12px] border-t px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.07em] ${
            isAnchor
              ? "border-hibiscus/60 bg-hibiscus text-white"
              : "border-seam bg-field text-ink-soft"
          }`}
        >
          {relation}
        </p>
      )}

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-[#b9c2cc]" />
    </div>
  );
}

export default memo(PersonNode);
