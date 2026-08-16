"use client";

import { useRef, useState } from "react";
import { usePersonSearch, type PersonSearchResult } from "./usePersonSearch";

type Props = {
  /** Called when the user picks a person from the results. */
  onSelect: (personId: string) => void;
};

/**
 * Name search overlay for the tree. Full width on a phone (where a 288px
 * centred box left no room for anything else), a fixed-width box from `sm`.
 */
export default function PersonSearch({ onSelect }: Props) {
  const { query, setQuery, results, searching } = usePersonSearch();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pick(result: PersonSearchResult) {
    onSelect(result.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  const showResults = open && query.trim().length >= 2;

  return (
    <div className="absolute left-3 right-3 top-3 z-20 sm:left-1/2 sm:right-auto sm:top-4 sm:w-80 sm:-translate-x-1/2">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search people…"
          aria-label="Search people"
          className="field pr-20 shadow-[0_8px_24px_-16px_rgb(16_26_46/0.5)]"
        />
        {searching && (
          <span className="absolute right-3 top-3 text-xs text-ink-soft">Searching…</span>
        )}
      </div>

      {showResults && (
        <ul className="floating absolute mt-2 max-h-[50dvh] w-full overflow-y-auto rounded-xl">
          {results.length === 0 && !searching ? (
            <li className="px-3 py-3 text-[15px] text-ink-soft">
              No one by that name. Check the spelling, or add them to the register.
            </li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault() /* keep focus for onBlur */}
                  onClick={() => pick(r)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors active:bg-cobalt-wash sm:min-h-0 sm:py-2.5 sm:hover:bg-cobalt-wash"
                >
                  <span className="truncate text-base text-ink">
                    {r.firstName} {r.lastName}
                  </span>
                  <span className="tnum shrink-0 text-xs text-ink-soft">
                    {r.birthYear ? `b. ${r.birthYear}` : r.isLiving ? "living" : "deceased"}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
