import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The shell every interior page shares: a way back to the register, a titled
 * masthead, and the double rule that separates a heading from its record.
 */
export default function RegisterPage({
  eyebrow,
  title,
  intro,
  wide = false,
  children,
}: {
  eyebrow?: string;
  title?: string;
  intro?: ReactNode;
  /** Wider measure for list-heavy pages like the pending queue. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-paper">
      <div
        className={`mx-auto w-full px-5 py-9 sm:py-14 ${wide ? "max-w-3xl" : "max-w-2xl"}`}
      >
        <Link href="/" className="nav-link">
          ← The register
        </Link>

        {title && (
          <div className="mt-8">
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h1 className="mt-1.5 font-display text-[30px] leading-[1.12] sm:text-[34px]">
              {title}
            </h1>
            {intro && (
              <p className="mt-2.5 max-w-[52ch] text-sm leading-relaxed text-ink-soft">
                {intro}
              </p>
            )}
          </div>
        )}

        <div className="rule-double mt-7" />
        <div className="settle mt-8">{children}</div>
      </div>
    </main>
  );
}
