"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminDuplicate = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  birthDatePrecision: "YEAR" | "MONTH" | "DAY";
  status: string;
};

export type AdminEdit = {
  id: string;
  requestType: string;
  payload: Record<string, unknown> | null;
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
  };
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
  "w-full min-h-11 rounded-lg border border-gray-700 bg-[#0d1117] px-3 py-2 text-base outline-none focus:border-[#58a6ff] sm:min-h-0 sm:text-sm";

function year(iso: string | null): string {
  return iso ? String(new Date(iso).getUTCFullYear()) : "";
}

/**
 * One submission = one decision. Every field is editable in place so the admin
 * can fix a typo and approve in one go, and a look-alike can be merged into
 * the person already in the register instead of creating a duplicate.
 *
 * Laid out as a single column with full-width controls: a side-by-side diff
 * does not fit on a phone, and the admin reviews on one.
 */
export default function SubmissionCard({ submission }: { submission: AdminSubmission }) {
  const router = useRouter();
  const [fields, setFields] = useState<Record<string, Record<string, string>>>({});
  const [merges, setMerges] = useState<Record<string, string | null>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valueFor = (edit: AdminEdit, key: string, fallback: string) =>
    fields[edit.id]?.[key] ?? fallback;

  const setField = (editId: string, key: string, value: string) =>
    setFields((prev) => ({ ...prev, [editId]: { ...prev[editId], [key]: value } }));

  async function act(action: "approve" | "reject") {
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
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <li className="rounded-2xl border border-gray-800 bg-[#161b22]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-800 px-4 py-3 text-xs text-gray-500">
        <span className="font-semibold text-gray-300">
          {submission.kind === "EDIT_PERSON" ? "Correction" : "New entry"}
        </span>
        <span>· {new Date(submission.submittedAt).toLocaleString()}</span>
        {submission.submitterHash && <span>· source {submission.submitterHash}</span>}
      </div>

      <div className="space-y-5 p-4">
        {submission.edits.map((edit) => {
          const merged = merges[edit.id];
          return (
            <div key={edit.id} className="rounded-xl border border-gray-800 p-3">
              {edit.requestType === "EDIT_PERSON" ? (
                <>
                  <p className="text-sm font-semibold text-gray-100">
                    {edit.person.firstName} {edit.person.lastName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">Suggested changes</p>
                  <dl className="mt-2 space-y-1.5">
                    {Object.entries(edit.payload ?? {}).map(([key, value]) => (
                      <div key={key} className="text-sm">
                        <dt className="text-xs uppercase tracking-wide text-gray-500">
                          {key}
                        </dt>
                        <dd className="text-gray-200">
                          {value === null || value === "" ? (
                            <span className="text-gray-500">cleared</span>
                          ) : (
                            String(value)
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
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

                  {edit.parents.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      Entered under{" "}
                      {edit.parents
                        .map((p) => `${p.name} (${p.role.toLowerCase()})`)
                        .join(" and ")}
                    </p>
                  )}

                  {edit.duplicates.length > 0 && (
                    <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                      <p className="text-xs font-semibold text-amber-300">
                        Already in the register?
                      </p>
                      <ul className="mt-2 space-y-2">
                        {edit.duplicates.map((duplicate) => (
                          <li key={duplicate.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setMerges((prev) => ({
                                  ...prev,
                                  [edit.id]:
                                    prev[edit.id] === duplicate.id ? null : duplicate.id,
                                }))
                              }
                              className={`min-h-11 w-full rounded-lg border px-3 text-left text-sm transition-colors ${
                                merged === duplicate.id
                                  ? "border-[#58a6ff] bg-[#58a6ff]/10 text-[#79c0ff]"
                                  : "border-gray-700 bg-[#0d1117] text-gray-200"
                              }`}
                            >
                              {merged === duplicate.id ? "✓ Link to " : "Link to "}
                              {duplicate.firstName} {duplicate.lastName}
                              {duplicate.birthDate && ` (b. ${year(duplicate.birthDate)})`}
                            </button>
                          </li>
                        ))}
                      </ul>
                      {merged && (
                        <p className="mt-2 text-xs text-gray-400">
                          This entry will be dropped and the link pointed at the
                          existing person.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
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

        {error && <p className="text-sm text-red-300">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => act("approve")}
            disabled={busy !== null}
            className="min-h-12 flex-1 rounded-lg border border-green-500/40 bg-green-500/10 text-sm font-semibold text-green-300 disabled:opacity-40"
          >
            {busy === "approve" ? "…" : "Approve"}
          </button>
          <button
            onClick={() => act("reject")}
            disabled={busy !== null}
            className="min-h-12 flex-1 rounded-lg border border-red-500/40 bg-red-500/10 text-sm font-semibold text-red-300 disabled:opacity-40"
          >
            {busy === "reject" ? "…" : "Reject"}
          </button>
        </div>
      </div>
    </li>
  );
}
