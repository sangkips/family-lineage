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
export default function AnchorPicker({
  onPick,
  onDismiss,
  mode = "first-visit",
}: Props) {
  const { query, setQuery, results, searching } = usePersonSearch();

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-cobalt-deep/45 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-card sm:h-auto sm:max-h-[80dvh] sm:max-w-md sm:rounded-2xl sm:border sm:border-seam sm:shadow-[0_24px_60px_-24px_rgb(16_26_46/0.55)]">
        {/* Full screen on a phone, so it carries the band like every other
            screen instead of opening on a blank sheet. */}
        <div
          className="band shrink-0 px-5 py-2.5 font-display text-[13px] font-bold uppercase tracking-[0.08em] sm:hidden"
          style={{ fontStretch: "87.5%" }}
        >
          The Family Register
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-5">
          <p className="eyebrow">The register</p>
          <h2 className="title mt-1.5 text-[26px]">
            {mode === "change"
              ? "Whose view is this?"
              : "Find yourself in the register"}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            Pick your name and the tree is drawn around you — everyone labelled
            by how they are related to you.
          </p>

          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your name…"
            aria-label="Search for your name"
            className="field mt-5 min-h-12"
          />

          <div className="-mx-1 mt-3 min-h-0 flex-1 overflow-y-auto px-1">
            {searching && (
              <p className="px-1 py-3 text-[15px] text-ink-soft">Searching…</p>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <p className="px-1 py-3 text-[15px] text-ink-soft">
                No matches. Someone may need to add you to the register first.
              </p>
            )}

            <ul className="space-y-1.5">
              {results.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => onPick(person.id)}
                    className="list-row min-h-12 w-full"
                  >
                    <span className="truncate text-base text-ink">
                      {person.firstName} {person.lastName}
                    </span>
                    <span className="tnum shrink-0 text-xs text-ink-soft">
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
            className="btn btn-quiet mt-4"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
          >
            {mode === "change" ? "Cancel" : "Just browse the tree"}
          </button>
        </div>
      </div>
    </div>
  );
}
