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
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-700 bg-[#161b22] text-gray-300 transition-colors active:bg-[#1f2630] sm:h-9 sm:w-9 sm:hover:border-gray-600"
      >
        <span aria-hidden className="text-lg leading-none">⋯</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-gray-800 bg-[#161b22] shadow-2xl"
        >
          {email && (
            <p className="truncate border-b border-gray-800 px-4 py-2.5 text-xs text-gray-500">
              {email}
            </p>
          )}
          {items.map((item) =>
            item.external ? (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center px-4 py-2.5 text-sm text-gray-300 transition-colors active:bg-[#0d1117] sm:hover:bg-[#0d1117]"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-11 items-center px-4 py-2.5 text-sm transition-colors active:bg-[#0d1117] sm:hover:bg-[#0d1117] ${
                  item.tone === "admin" ? "text-amber-300" : "text-gray-300"
                }`}
              >
                {item.label}
              </Link>
            )
          )}
          {children && (
            <div className="border-t border-gray-800 p-2">{children}</div>
          )}
        </div>
      )}
    </div>
  );
}
