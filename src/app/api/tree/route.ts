import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getTree, resolveViewer } from "@/lib/tree";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

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
    // Signed-in users see their own PENDING ghost nodes (admins see all).
    const response = NextResponse.json({});
    const supabase = createRouteHandlerSupabaseClient(request, response);
    const user = await getUserFromRequest(request, supabase);
    const viewer = user ? await resolveViewer(user.id) : null;

    const data = await getTree({ rootId, depth, viewer });
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/tree failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
