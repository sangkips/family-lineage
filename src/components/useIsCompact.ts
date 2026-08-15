"use client";

import { useEffect, useState } from "react";

/** Tailwind's `sm` breakpoint — below it we are on a phone. */
const COMPACT_QUERY = "(max-width: 639px)";

/**
 * True on phone-sized viewports. Starts false so the server and the first
 * client paint agree, then corrects on mount.
 */
export function useIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY);
    const sync = () => setIsCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isCompact;
}
