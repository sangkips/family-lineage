import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { buildGedcom } from "@/lib/gedcom";
import { getTree, resolveViewer } from "@/lib/tree";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

/**
 * GET /api/export/gedcom — download the whole tree as a GEDCOM 5.5.1 file.
 *
 * Honors the same visibility rules as the tree itself: anonymous visitors get
 * approved people only, signed-in members additionally see their own PENDING
 * nodes, and privacy toggles are redacted before the export is built.
 */
export async function GET(request: NextRequest) {
  try {
    const response = NextResponse.json({});
    const supabase = createRouteHandlerSupabaseClient(request, response);
    const user = await getUserFromRequest(request, supabase);
    const viewer = user ? await resolveViewer(user.id) : null;

    const data = await getTree({ viewer });
    const gedcom = buildGedcom(data);

    return new NextResponse(gedcom, {
      headers: {
        "Content-Type": "text/x-gedcom; charset=utf-8",
        "Content-Disposition": 'attachment; filename="family-tree.ged"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("GET /api/export/gedcom failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
