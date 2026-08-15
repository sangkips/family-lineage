"use client";

import { useEffect, useRef, useState } from "react";

export type PersonSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  birthYear: number | null;
  isLiving: boolean;
};

/**
 * Debounced name lookup against `/api/search` (approved people only).
 * Shared by the tree's search overlay, the "find yourself" anchor picker and
 * the parent picker, so all three behave identically.
 */
export function usePersonSearch(minLength = 2, debounceMs = 300) {
  const [query, setQuery] = useState("");
  const [fetched, setFetched] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const trimmed = query.trim();
  const active = trimmed.length >= minLength;

  useEffect(() => {
    if (!active) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        setFetched(res.ok ? await res.json() : []);
      } catch {
        setFetched([]);
      } finally {
        setSearching(false);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [trimmed, active, debounceMs]);

  return {
    query,
    setQuery,
    // Derived rather than cleared in an effect, so a too-short query never
    // shows the previous query's results for a frame.
    results: active && Array.isArray(fetched) ? fetched : [],
    searching: active && searching,
    clear: () => setQuery(""),
  };
}
