import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

/**
 * GET /api/admin/pending — list unreviewed claims/edits (admin only).
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = createRouteHandlerSupabaseClient(request, response);
  const user = await getUserFromRequest(request, supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.role !== UserRole.ADMIN) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const pending = await prisma.pendingEdit.findMany({
    where: { decision: null },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          maidenName: true,
          gender: true,
          birthDate: true,
          birthPlace: true,
          bio: true,
          status: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  return NextResponse.json(
    pending.map((e) => ({
      id: e.id,
      requestType: e.requestType,
      submittedAt: e.submittedAt.toISOString(),
      person: {
        ...e.person,
        birthDate: e.person.birthDate?.toISOString() ?? null,
      },
    }))
  );
}
