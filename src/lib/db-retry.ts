/**
 * Retry a database call once when it fails for a transient network reason.
 *
 * The database is in Frankfurt and the people using this are on mobile
 * connections, so a DNS hiccup or dropped socket is routine rather than
 * exceptional — `EAI_AGAIN` in particular is the resolver saying "ask again".
 * One quick retry turns most of those from a crashed page into a page that
 * took a moment longer.
 *
 * Deliberately narrow: only known transient failures are retried, and only
 * once. A genuine error (bad query, constraint violation) must still surface
 * immediately rather than being tried twice and hidden.
 */

const TRANSIENT_PATTERNS = [
  "EAI_AGAIN", // DNS lookup failed, temporarily
  "ENOTFOUND",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "Connection terminated",
  "Timed out fetching a new connection",
  "P1001", // Prisma: can't reach database server
  "P1017", // Prisma: server has closed the connection
];

export function isTransientDbError(error: unknown): boolean {
  const text =
    error instanceof Error
      ? `${error.message} ${(error as { code?: string }).code ?? ""}`
      : String(error);
  return TRANSIENT_PATTERNS.some((pattern) => text.includes(pattern));
}

export async function withDbRetry<T>(
  run: () => Promise<T>,
  delayMs = 250
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return run();
  }
}
