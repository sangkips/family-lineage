import Link from "next/link";
import type { ReactNode } from "react";

/** Which part of the register you are in — the hem colour says so. */
export type Hem = "register" | "contribute" | "moderate";

const HEM_COLOR: Record<Hem, string> = {
  register: "var(--color-hibiscus)",
  contribute: "var(--color-leaf)",
  moderate: "var(--color-ochre)",
};

/**
 * The shell every interior page shares: the cobalt band across the top with
 * the way back, a hem whose colour says which part of the register this is,
 * the open field of content, and one printed line along the bottom.
 */
export default function RegisterPage({
  eyebrow,
  title,
  intro,
  hem = "register",
  jina,
  wide = false,
  children,
}: {
  eyebrow?: string;
  title?: string;
  intro?: ReactNode;
  hem?: Hem;
  /** The one rule this page runs on, printed along the foot. */
  jina?: ReactNode;
  /** Wider measure for list-heavy pages like the moderation queue. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main
      className="flex min-h-dvh flex-col bg-field"
      style={{ "--hem-color": HEM_COLOR[hem] } as React.CSSProperties}
    >
      <div className="band">
        <div
          className={`mx-auto flex w-full items-center px-4 sm:px-6 ${
            wide ? "max-w-3xl" : "max-w-2xl"
          }`}
        >
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 font-display text-[13px] font-bold uppercase tracking-[0.08em] text-white"
            style={{ fontStretch: "87.5%" }}
          >
            <span aria-hidden>←</span>
            The Family Register
          </Link>
        </div>
      </div>

      <div
        className={`mx-auto flex w-full flex-1 flex-col px-4 pb-10 pt-7 sm:px-6 sm:pt-9 ${
          wide ? "max-w-3xl" : "max-w-2xl"
        }`}
      >
        {title && (
          <div className="mb-7">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="title mt-1.5 sm:text-[34px]">{title}</h1>
            {intro && (
              <p className="mt-2.5 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
                {intro}
              </p>
            )}
          </div>
        )}

        <div className="flex-1">{children}</div>

        {jina && <p className="jina mt-10">{jina}</p>}
      </div>
    </main>
  );
}
