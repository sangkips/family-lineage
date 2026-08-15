import { NextRequest, NextResponse } from "next/server";
import { PersonStatus } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/**
 * DELETE /api/admin/people/[id] — remove a person who is connected to nobody.
 *
 * Deliberately narrow: it refuses anyone who has a parent or a child, so it
 * cannot quietly become a delete-anyone tool. Removal is a soft delete, so a
 * mistake stays recoverable in the database and the audit trail survives.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const person = await prisma.person.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: { select: { parents: true, children: true } },
      },
    });

    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    if (person._count.parents > 0 || person._count.children > 0) {
      return NextResponse.json(
        {
          error:
            "This person is connected to relatives, so they cannot be deleted here.",
        },
        { status: 409 }
      );
    }

    await prisma.person.update({
      where: { id },
      data: { status: PersonStatus.REJECTED, deletedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/people/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
