import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * An opaque tag for the source of an anonymous submission.
 *
 * Contributors are anonymous by design — no account, no email, nothing that
 * identifies them. This exists for one purpose: if the open endpoint is
 * flooded, the admin can reject a whole burst instead of clicking through it
 * row by row. The address itself is never stored, only a salted hash of it,
 * and without `SUBMITTER_SALT` configured nothing is recorded at all.
 */
export function submitterHash(request: NextRequest): string | null {
  const salt = process.env.SUBMITTER_SALT;
  if (!salt) return null;

  const forwarded = request.headers.get("x-forwarded-for");
  const address =
    forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
  if (!address) return null;

  // Truncated: enough to group one burst, too short to be worth attacking.
  return createHash("sha256").update(`${salt}:${address}`).digest("hex").slice(0, 16);
}
