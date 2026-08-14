"use client";

import { useEffect, useRef, useState } from "react";

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  birthYear: number | null;
  isLiving: boolean;
};

type Props = {
  /** Called when the user picks a person from the results. */
  onSelect: (personId: string) => void;
};

/**
 * Name search overlay for the tree. Queries /api/search (approved people
 * only) with a 300ms debounce, then lets the user jump to a result.
 */
export default function PersonSearch({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(Array.isArray(data) ? data : []);
          setOpen(true);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function pick(result: SearchResult) {
    onSelect(result.id);
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="absolute left-1/2 top-4 z-20 w-72 -translate-x-1/2 sm:w-80">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search people…"
          className="w-full rounded-lg border border-gray-700 bg-[#0d1117]/90 px-3 py-2 pr-16 text-sm text-gray-200 shadow-lg outline-none backdrop-blur placeholder:text-gray-500 focus:border-[#58a6ff]"
        />
        {searching && (
          <span className="absolute right-3 top-2.5 text-xs text-gray-500">
            Searching…
          </span>
        )}
      </div>

      {open && (
        <ul className="absolute mt-2 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-800 bg-[#161b22] shadow-2xl">
          {results.length === 0 && !searching ? (
            <li className="px-3 py-2.5 text-sm text-gray-500">No matches found.</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault() /* keep focus for onBlur */ }
                  onClick={() => pick(r)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-[#0d1117]"
                >
                  <span className="truncate text-sm text-gray-200">
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
