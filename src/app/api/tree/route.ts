import { NextRequest, NextResponse } from "next/server";
import { getTree } from "@/lib/tree";

/**
 * GET /api/tree — public, read-only.
 * Query params:
 *   rootId  — start the subtree from a specific person (default: root generation)
 *   depth   — max generations down from the root (default: full tree)
 */
export async function GET(request: NextRequest) {
  const rootId = request.nextUrl.searchParams.get("rootId") ?? undefined;
  const depthParam = request.nextUrl.searchParams.get("depth");
  const depth = depthParam ? Number.parseInt(depthParam, 10) : undefined;

  if (depthParam && (Number.isNaN(depth) || depth! < 1)) {
    return NextResponse.json({ error: "depth must be a positive integer" }, { status: 400 });
  }

  try {
    const data = await getTree({ rootId, depth });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/tree failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
