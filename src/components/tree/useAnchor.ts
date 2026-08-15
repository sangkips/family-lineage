"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const ANCHOR_KEY = "familyTree.anchorId";
const DISMISSED_KEY = "familyTree.anchorDismissed";

// localStorage is an external store, so it is read through
// useSyncExternalStore rather than copied into state inside an effect.
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Fires when another tab changes the anchor.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function emitChange() {
  for (const listener of listeners) listener();
}

const readAnchor = () => window.localStorage.getItem(ANCHOR_KEY);
const readDismissed = () => window.localStorage.getItem(DISMISSED_KEY) === "true";

/**
 * The person the tree is told from the point of view of.
 *
 * Lives in the URL (`?focus=<id>`) so a view can be shared over WhatsApp, and
 * is mirrored into localStorage so a return visit opens where you left off.
 * Visitors have no account, so those two places are the only memory we have.
 */
export function useAnchor() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlAnchor = searchParams.get("focus");

  const storedAnchor = useSyncExternalStore(subscribe, readAnchor, () => null);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => false);
  // Server and hydration render get `false`, the next client render `true`,
  // so nothing decides about the anchor until localStorage is readable.
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  // A shared ?focus= link wins, and is remembered for next time.
  useEffect(() => {
    if (!urlAnchor || urlAnchor === window.localStorage.getItem(ANCHOR_KEY)) return;
    window.localStorage.setItem(ANCHOR_KEY, urlAnchor);
    emitChange();
  }, [urlAnchor]);

  const anchorId = urlAnchor ?? storedAnchor;

  const setAnchor = useCallback(
    (personId: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (personId) {
        window.localStorage.setItem(ANCHOR_KEY, personId);
        next.set("focus", personId);
      } else {
        window.localStorage.removeItem(ANCHOR_KEY);
        next.delete("focus");
      }

      // The native history API is wired into the Next router, so this keeps
      // the URL shareable without re-running this force-dynamic page's fetch.
      const query = next.toString();
      window.history.replaceState(null, "", query ? `${pathname}?${query}` : pathname);
      emitChange();
    },
    [pathname, searchParams]
  );

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISSED_KEY, "true");
    emitChange();
  }, []);

  return {
    anchorId,
    setAnchor,
    /** Show the "find yourself" prompt only once we know they haven't chosen. */
    needsAnchor: ready && !anchorId && !dismissed,
    dismiss,
  };
}
