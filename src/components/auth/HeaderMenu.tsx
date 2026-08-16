"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type HeaderMenuItem = {
  href: string;
  label: string;
  /** Rendered as a plain anchor (file downloads, non-router routes). */
  external?: boolean;
  tone?: "default" | "admin";
};

/**
 * Overflow menu for the header. On a phone the header can hold a title and
 * one action; everything else lives behind this button.
 */
export default function HeaderMenu({
  items,
  email,
  children,
}: {
  items: HeaderMenuItem[];
  /** Signed-in account, shown at the top of the sheet. */
  email?: string | null;
  /** Sign-out control, rendered inside the sheet. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (items.length === 0 && !children) return null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="More options"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-white/25 text-white transition-colors active:bg-white/15 sm:h-9 sm:w-9 sm:hover:bg-white/15"
      >
        <svg aria-hidden className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.4" />
          <circle cx="8" cy="8" r="1.4" />
          <circle cx="13" cy="8" r="1.4" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="floating absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl"
        >
          {email && (
            <p className="truncate border-b border-seam px-4 py-2.5 text-xs text-ink-soft">
              {email}
            </p>
          )}
          {items.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center px-4 py-2.5 text-[15px] text-ink transition-colors active:bg-cobalt-wash sm:hover:bg-cobalt-wash"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center px-4 py-2.5 text-[15px] transition-colors active:bg-cobalt-wash sm:hover:bg-cobalt-wash ${
                  item.tone === "admin" ? "font-semibold text-ochre-ink" : "text-ink"
                }`}
              >
                {item.label}
              </Link>
            )
          )}
          {children && <div className="border-t border-seam p-2">{children}</div>}
        </div>
      )}
    </div>
  );
}
