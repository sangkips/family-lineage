import { NextRequest, NextResponse } from "next/server";
import { PersonStatus, UserRole } from "@/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateProfile } from "@/lib/profile";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

/**
 * GET /api/search?q= — name search over approved people.
 * Used by the "claim me" / "add child" parent picker.
 *
 * Privacy: living people who hide their full name are excluded from results
 * for non-admins (their name is the search key, so returning a placeholder
 * would be useless), and their birth year is withheld when they hide birth
 * dates. Admins see everything.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const response = NextResponse.json({});
    const supabase = createRouteHandlerSupabaseClient(request, response);
    const user = await getUserFromRequest(request, supabase);
    const profile = user ? await getOrCreateProfile(user) : null;
    const isAdmin = profile?.role === UserRole.ADMIN;

    const people = await prisma.person.findMany({
      where: {
        status: PersonStatus.APPROVED,
        deletedAt: null,
        // A living person who hides their full name is unsearchable by name
        // for everyone except admins and themselves.
        ...(isAdmin
          ? {}
          : { OR: [{ hideFullName: false }, { isLiving: false }] }),
        AND: [
          {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        birthDate: true,
        isLiving: true,
        hideBirthDate: true,
        hideFullName: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 10,
    });

    return NextResponse.json(
      people.map((p) => {
        // Non-admins don't get the birth year of living people who hid it.
        const canSeeBirth = isAdmin || !p.isLiving || !p.hideBirthDate;
        return {
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          gender: p.gender,
          birthYear: canSeeBirth && p.birthDate ? p.birthDate.getFullYear() : null,
          isLiving: p.isLiving,
        };
      })
    );
  } catch (error) {
    console.error("GET /api/search failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
