"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export type AdminDuplicate = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  birthDatePrecision: "YEAR" | "MONTH" | "DAY";
  status: string;
};

export type AdminMarriage = {
  id: string;
  partnerA: string;
  partnerB: string;
  startDate: string | null;
  endDate: string | null;
  endReason: string | null;
};

export type AdminEdit = {
  id: string;
  requestType: string;
  payload: Record<string, unknown> | null;
  /** Exactly one of person / marriage is set. */
  person: {
    id: string;
    firstName: string;
    lastName: string;
    maidenName: string | null;
    gender: string | null;
    birthDate: string | null;
    birthDatePrecision: "YEAR" | "MONTH" | "DAY";
    birthPlace: string | null;
    bio: string | null;
    isLiving: boolean;
    hideBirthDate: boolean;
    hideFullName: boolean;
    status: string;
  } | null;
  marriage: AdminMarriage | null;
  parents: { id: string; name: string; role: string }[];
  duplicates: AdminDuplicate[];
};

export type AdminSubmission = {
  id: string;
  kind: string;
  submitterHash: string | null;
  submittedAt: string;
  edits: AdminEdit[];
};

const field =
  "w-full min-h-11 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-base outline-none focus:border-[#58a6ff] sm:min-h-9 sm:text-sm";

function year(iso: string | null): string {
  return iso ? String(new Date(iso).getUTCFullYear()) : "";
}

/** Just the names — one row may carry a person plus an inline parent. */
function names(submission: AdminSubmission): string {
  return submission.edits
    .map((edit) =>
      edit.marriage
        ? `${edit.marriage.partnerA} ⚭ ${edit.marriage.partnerB}`
        : edit.person
          ? `${edit.person.firstName} ${edit.person.lastName}`
          : ""
    )
    .filter(Boolean)
    .join(" + ");
}

function kindLabel(kind: string): string {
  if (kind === "EDIT_PERSON") return "Correction";
  if (kind === "ADD_MARRIAGE") return "Marriage";
  return "New entry";
}

/**
 * One submission as a single line: who it is and what kind of change it is.
 * Clicking the name opens the details — the editable fields, the merge choice
 * and where the entry came from — because a queue is read by scanning names,
 * not forms. The ⋯ menu carries only the two decisions.
 */
export default function SubmissionRow({ submission }: { submission: AdminSubmission }) {
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Record<string, Record<string, string>>>({});
  const [merges, setMerges] = useState<Record<string, string | null>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Hide the row as soon as the decision lands, without waiting for the
   *  server round trip to Frankfurt and the page refetch behind it. */
  const [settled, setSettled] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const setField = (editId: string, key: string, value: string) =>
    setFields((prev) => ({ ...prev, [editId]: { ...prev[editId], [key]: value } }));

  const valueFor = (edit: AdminEdit, key: string, fallback: string) =>
    fields[edit.id]?.[key] ?? fallback;

  const duplicateCount = submission.edits.reduce(
    (total, edit) => total + edit.duplicates.length,
    0
  );

  async function act(action: "approve" | "reject") {
    setMenuOpen(false);
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/submissions/${submission.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          note: note.trim() || undefined,
          people: submission.edits.map((edit) => {
            const edited = fields[edit.id] ?? {};
            const changes: Record<string, unknown> = {};
            if (edited.firstName !== undefined) changes.firstName = edited.firstName;
            if (edited.lastName !== undefined) changes.lastName = edited.lastName;
            if (edited.birthPlace !== undefined) changes.birthPlace = edited.birthPlace;
            if (edited.birthYear !== undefined) {
              changes.birthDate = edited.birthYear
                ? new Date(Date.UTC(Number(edited.birthYear), 0, 1)).toISOString()
                : null;
              changes.birthDatePrecision = "YEAR";
            }
            return {
              editId: edit.id,
              fields: changes,
              mergeInto: merges[edit.id] ?? null,
            };
          }),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        toast(body.error ?? "Something went wrong", "error");
        return;
      }

      const merged = Object.values(merges).filter(Boolean).length;
      setSettled(true);
      toast(
        action === "approve"
          ? merged > 0
            ? `Approved — ${merged} linked to an existing person`
            : `Approved ${names(submission)}`
          : `Rejected ${names(submission)}`,
        action === "approve" ? "success" : "info"
      );
      router.refresh();
    } catch {
      setError("Network error");
      toast("Network error — nothing was saved", "error");
    } finally {
      setBusy(null);
    }
  }

  // Already decided: the refetch will drop it, so stop showing it now.
  if (settled) return null;

  return (
    <li className="rounded-xl border border-gray-800 bg-[#161b22]">
      <div className="flex items-center gap-3 p-3">
        <div className="min-w-0 flex-1">
          {/* The name is the way into the details — the obvious thing to click
              when you want to know more before deciding. */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="max-w-full truncate text-left text-sm font-semibold text-gray-100 hover:text-[#79c0ff] hover:underline"
          >
            {names(submission)}
            {duplicateCount > 0 && (
              <span
                title={`${duplicateCount} possible duplicate${duplicateCount > 1 ? "s" : ""} — open the details to link instead of creating a copy`}
                className="ml-2 align-middle text-xs text-amber-400"
              >
                ⚠
              </span>
            )}
          </button>
        </div>

        <span className="shrink-0 text-xs text-gray-500">
          {kindLabel(submission.kind)}
        </span>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy !== null}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Actions for ${names(submission)}`}
            className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-700 text-gray-300 disabled:opacity-40 sm:h-9 sm:w-9"
          >
            {busy ? "…" : <span aria-hidden className="text-lg leading-none">⋯</span>}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-800 bg-[#0d1117] shadow-2xl"
            >
              <button
                role="menuitem"
                onClick={() => act("approve")}
                className="flex min-h-11 w-full items-center px-4 text-sm text-green-300 hover:bg-[#161b22]"
              >
                Approve
              </button>
              <button
                role="menuitem"
                onClick={() => act("reject")}
                className="flex min-h-11 w-full items-center px-4 text-sm text-red-300 hover:bg-[#161b22]"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      </div>

      {error && <p className="px-3 pb-2 text-xs text-red-300">{error}</p>}

      {open && (
        <div className="space-y-4 border-t border-gray-800 p-3">
          <p className="text-xs text-gray-500">
            {[
              ...submission.edits.map((edit) => {
                if (edit.marriage) {
                  return edit.marriage.startDate
                    ? `married ${year(edit.marriage.startDate)}`
                    : "wedding year not given";
                }
                if (edit.requestType === "EDIT_PERSON" && edit.payload) {
                  return Object.entries(edit.payload)
                    .map(
                      ([key, value]) =>
                        `${key}: ${value === null || value === "" ? "cleared" : String(value)}`
                    )
                    .join(", ");
                }
                return edit.parents.length
                  ? `child of ${edit.parents.map((p) => `${p.name} (${p.role.toLowerCase()})`).join(" and ")}`
                  : null;
              }),
              new Date(submission.submittedAt).toLocaleString(),
              submission.submitterHash ? `source ${submission.submitterHash}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {submission.edits.map((edit) => {
            if (!edit.person || edit.requestType === "EDIT_PERSON") return null;
            const merged = merges[edit.id];
            return (
              <div key={edit.id} className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-4">
                  <input
                    aria-label="First name"
                    value={valueFor(edit, "firstName", edit.person.firstName)}
                    onChange={(e) => setField(edit.id, "firstName", e.target.value)}
                    disabled={Boolean(merged)}
                    className={`${field} disabled:opacity-40`}
                  />
                  <input
                    aria-label="Last name"
                    value={valueFor(edit, "lastName", edit.person.lastName)}
                    onChange={(e) => setField(edit.id, "lastName", e.target.value)}
                    disabled={Boolean(merged)}
                    className={`${field} disabled:opacity-40`}
                  />
                  <input
                    aria-label="Birth year"
                    inputMode="numeric"
                    value={valueFor(edit, "birthYear", year(edit.person.birthDate))}
                    onChange={(e) => setField(edit.id, "birthYear", e.target.value)}
                    disabled={Boolean(merged)}
                    className={`${field} disabled:opacity-40`}
                  />
                  <input
                    aria-label="Birthplace"
                    value={valueFor(edit, "birthPlace", edit.person.birthPlace ?? "")}
                    onChange={(e) => setField(edit.id, "birthPlace", e.target.value)}
                    disabled={Boolean(merged)}
                    className={`${field} disabled:opacity-40`}
                  />
                </div>

                {edit.duplicates.map((duplicate) => (
                  <button
                    key={duplicate.id}
                    type="button"
                    onClick={() =>
                      setMerges((prev) => ({
                        ...prev,
                        [edit.id]: prev[edit.id] === duplicate.id ? null : duplicate.id,
                      }))
                    }
                    className={`min-h-11 w-full rounded-lg border px-3 text-left text-xs sm:min-h-9 ${
                      merged === duplicate.id
                        ? "border-[#58a6ff] bg-[#58a6ff]/10 text-[#79c0ff]"
                        : "border-gray-700 bg-[#0d1117] text-gray-300"
                    }`}
                  >
                    {merged === duplicate.id ? "✓ linking to " : "Link to existing "}
                    {duplicate.firstName} {duplicate.lastName}
                    {duplicate.birthDate && ` (b. ${year(duplicate.birthDate)})`}
                  </button>
                ))}
              </div>
            );
          })}

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            aria-label="Review note"
            className={field}
          />

          <div className="flex gap-2">
            <button
              onClick={() => act("approve")}
              disabled={busy !== null}
              className="min-h-11 flex-1 rounded-lg border border-green-500/40 bg-green-500/10 text-xs font-semibold text-green-300 disabled:opacity-40 sm:min-h-9"
            >
              Approve
            </button>
            <button
              onClick={() => setOpen(false)}
              className="min-h-11 rounded-lg border border-gray-700 px-4 text-xs text-gray-300 sm:min-h-9"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
