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
          className="w-full rounded-xl border border-gray-700 bg-[#0d1117]/95 px-3 py-2.5 pr-20 text-base text-gray-200 shadow-lg outline-none backdrop-blur placeholder:text-gray-500 focus:border-[#58a6ff] sm:text-sm"
        />
        {searching && (
          <span className="absolute right-3 top-3 text-xs text-gray-500 sm:top-2.5">
            Searching…
          </span>
        )}
      </div>

      {showResults && (
        <ul className="absolute mt-2 max-h-[50dvh] w-full overflow-y-auto rounded-xl border border-gray-800 bg-[#161b22] shadow-2xl">
          {results.length === 0 && !searching ? (
            <li className="px-3 py-3 text-sm text-gray-500">No matches found.</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault() /* keep focus for onBlur */}
                  onClick={() => pick(r)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors active:bg-[#0d1117] sm:min-h-0 sm:py-2.5 sm:hover:bg-[#0d1117]"
                >
                  <span className="truncate text-base text-gray-200 sm:text-sm">
                    {r.firstName} {r.lastName}
                  </span>
                  <span className="shrink-0 text-xs text-gray-500">
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
