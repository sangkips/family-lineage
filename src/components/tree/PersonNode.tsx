import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { PersonDTO } from "@/lib/tree";

export type PersonNodeData = {
  person: PersonDTO;
  generationColor: string;
};

export type PersonFlowNode = Node<PersonNodeData, "person">;

function formatYears(person: PersonDTO): string {
  const birth = person.birthDate
    ? String(new Date(person.birthDate).getFullYear())
    : "?";
  if (!person.isLiving && person.deathDate) {
    return `${birth} – ${new Date(person.deathDate).getFullYear()}`;
  }
  return person.isLiving ? `${birth} – present` : birth;
}

function PersonNode({ data, selected }: NodeProps<PersonFlowNode>) {
  const { person, generationColor } = data;
  const isPending = person.status === "PENDING";
  const initials = `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase();

  const avatarStyles =
    person.gender === "FEMALE"
      ? "bg-pink-500/20 text-pink-300 border-pink-500/50"
      : person.gender === "MALE"
        ? "bg-blue-500/20 text-blue-300 border-blue-500/50"
        : "bg-purple-500/20 text-purple-300 border-purple-500/50";

  return (
    <div
      className={`w-[200px] rounded-xl border bg-[#161b22] shadow-lg transition-shadow ${
        selected
          ? "border-[#58a6ff] ring-2 ring-[#58a6ff]/40"
          : isPending
            ? "border-dashed border-amber-500/60"
            : "border-gray-700/80"
      } ${isPending ? "opacity-80" : ""}`}
      style={{ borderTop: `3px solid ${isPending ? "#f59e0b" : generationColor}` }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${avatarStyles}`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-100">
            {person.firstName} {person.lastName}
          </p>
          <p className="truncate text-xs text-gray-400">
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
      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2" />
    </div>
  );
}

export default memo(PersonNode);
