import { NextRequest, NextResponse } from "next/server";
import { PersonStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/search?q= — public name search over approved people.
 * Used by the "claim me" parent picker.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  try {
    const people = await prisma.person.findMany({
      where: {
        status: PersonStatus.APPROVED,
        deletedAt: null,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        gender: true,
        birthDate: true,
        isLiving: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 10,
    });

    return NextResponse.json(
      people.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        gender: p.gender,
        birthYear: p.birthDate ? p.birthDate.getFullYear() : null,
        isLiving: p.isLiving,
      }))
    );
  } catch (error) {
    console.error("GET /api/search failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
