import { NextRequest, NextResponse } from "next/server";
import { PersonStatus, UserRole } from "@/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProfile } from "@/lib/profile";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

/**
 * POST /api/admin/pending/[id] — approve or reject a pending claim (admin only).
 * Body: { action: "approve" | "reject", note?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const response = NextResponse.json({});
  const supabase = createRouteHandlerSupabaseClient(request, response);
  const user = await getUserFromRequest(request, supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(user);
  if (profile.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  let body: { action?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json(
      { error: "action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  const edit = await prisma.pendingEdit.findUnique({ where: { id } });
  if (!edit) {
    return NextResponse.json({ error: "Pending edit not found" }, { status: 404 });
  }
  if (edit.decision) {
    return NextResponse.json(
      { error: "This entry has already been reviewed" },
      { status: 409 }
    );
  }

  const approve = body.action === "approve";
  await prisma.$transaction([
    prisma.person.update({
      where: { id: edit.personId },
      data: approve
        ? { status: PersonStatus.APPROVED, deletedAt: null }
        : { status: PersonStatus.REJECTED, deletedAt: new Date() },
    }),
    prisma.pendingEdit.update({
      where: { id },
      data: {
        decision: approve ? "APPROVED" : "REJECTED",
        reviewedBy: user.id,
        reviewedAt: new Date(),
        adminNote: body.note?.trim() || null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, decision: approve ? "APPROVED" : "REJECTED" });
}
