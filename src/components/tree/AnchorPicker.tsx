"use client";

import { usePersonSearch } from "./usePersonSearch";

type Props = {
  onPick: (personId: string) => void;
  onDismiss: () => void;
  /** Shown when changing an anchor that is already set. */
  mode?: "first-visit" | "change";
};

/**
 * "Find yourself in the register" — the entry point that turns the tree from
 * a wall of strangers into a story about someone. Full screen on a phone,
 * a centred dialog from `sm` up.
 */
export default function AnchorPicker({ onPick, onDismiss, mode = "first-visit" }: Props) {
  const { query, setQuery, results, searching } = usePersonSearch();

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0d1117]/95 backdrop-blur sm:items-center sm:justify-center sm:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden border-gray-800 bg-[#0d1117] p-5 sm:h-auto sm:max-h-[80dvh] sm:max-w-md sm:rounded-2xl sm:border sm:bg-[#161b22] sm:shadow-2xl">
        <h2 className="text-xl font-bold text-gray-100">
          {mode === "change" ? "Whose view is this?" : "Find yourself in the register"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-gray-400">
          Pick your name and the tree is drawn around you — everyone labelled by
          how they are related to you.
        </p>

        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your name…"
          aria-label="Search for your name"
          className="mt-5 w-full rounded-xl border border-gray-700 bg-[#0d1117] px-4 py-3 text-base text-gray-100 outline-none placeholder:text-gray-500 focus:border-[#58a6ff] sm:bg-[#0d1117]"
        />

        <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
          {searching && <p className="px-1 py-3 text-sm text-gray-500">Searching…</p>}

          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-1 py-3 text-sm text-gray-500">
              No matches. Someone may need to add you to the register first.
            </p>
          )}

          <ul className="space-y-1.5">
            {results.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => onPick(person.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#161b22] px-4 py-3 text-left transition-colors active:bg-[#1f2630] sm:bg-[#0d1117] sm:hover:border-gray-700"
                >
                  <span className="truncate text-base text-gray-100">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
                    {person.birthYear
                      ? `b. ${person.birthYear}`
                      : person.isLiving
                        ? "living"
                        : "deceased"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 min-h-11 w-full rounded-xl border border-gray-800 px-4 py-2.5 text-sm text-gray-400 transition-colors active:bg-[#161b22]"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          {mode === "change" ? "Cancel" : "Just browse the tree"}
        </button>
      </div>
    </div>
  );
}
