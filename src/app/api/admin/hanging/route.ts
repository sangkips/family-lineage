import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/hanging — people connected to nobody.
 *
 * "Hanging" means no link in either direction: not somebody's child and not
 * somebody's parent. Being parentless is not enough — the oldest generation
 * and everyone who married in are parentless and entirely legitimate.
 *
 * The submission endpoint refuses to create these, so this should only ever
 * turn up rows predating that guard.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const people = await prisma.person.findMany({
    where: {
      deletedAt: null,
      parents: { none: {} },
      children: { none: {} },
      // A marriage connects someone just as surely as a parent link does.
      marriagesAsA: { none: {} },
      marriagesAsB: { none: {} },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      birthDatePrecision: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    people.map((person) => ({
      ...person,
      birthDate: person.birthDate?.toISOString() ?? null,
      createdAt: person.createdAt.toISOString(),
    }))
  );
}

export const dynamic = "force-dynamic";
