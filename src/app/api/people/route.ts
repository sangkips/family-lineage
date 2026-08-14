import { NextRequest, NextResponse } from "next/server";
import { Gender, ParentRole, PersonStatus } from "@/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

type ParentLinkInput = { parentId: string; role: ParentRole };
type AddChildBody = {
  firstName?: string;
  lastName?: string;
  maidenName?: string;
  gender?: Gender;
  birthDate?: string | null;
  birthPlace?: string;
  parentLinks?: ParentLinkInput[];
};

const MAX_PARENTS = 2;
const VALID_ROLES = new Set<string>(Object.values(ParentRole));

/**
 * POST /api/people — a signed-in member adds a child under 1-2 parents.
 * The person is created as PENDING (hidden from the public tree) with a
 * PendingEdit for admin review. Unlike /api/claim, no Profile is bound —
 * the submitter is adding someone else to the tree.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = createRouteHandlerSupabaseClient(request, response);

  const user = await getUserFromRequest(request, supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let body: AddChildBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "firstName and lastName are required" },
      { status: 400 }
    );
  }

  const parentLinks = (body.parentLinks ?? []).slice(0, MAX_PARENTS);
  for (const link of parentLinks) {
    if (!link?.parentId || !VALID_ROLES.has(link.role)) {
      return NextResponse.json(
        { error: "Each parent link needs a valid parentId and role" },
        { status: 400 }
      );
    }
  }

  const gender = body.gender ? (body.gender as Gender) : undefined;
  const birthDate = body.birthDate ? new Date(body.birthDate) : null;
  if (body.birthDate && Number.isNaN(birthDate!.getTime())) {
    return NextResponse.json({ error: "birthDate is invalid" }, { status: 400 });
  }

  try {
    // Parents must exist and be approved.
    if (parentLinks.length > 0) {
      const parentIds = parentLinks.map((l) => l.parentId);
      const parents = await prisma.person.findMany({
        where: { id: { in: parentIds }, status: PersonStatus.APPROVED, deletedAt: null },
        select: { id: true },
      });
      if (parents.length !== new Set(parentIds).size) {
        return NextResponse.json(
          { error: "One or more selected parents were not found" },
          { status: 400 }
        );
      }
    }

    const personId = await prisma.$transaction(async (tx) => {
      const person = await tx.person.create({
        data: {
          firstName,
          lastName,
          maidenName: body.maidenName?.trim() || null,
          gender: gender ?? null,
          birthDate,
          birthPlace: body.birthPlace?.trim() || null,
          isLiving: true,
          status: PersonStatus.PENDING,
          createdBy: user.id,
        },
      });

      if (parentLinks.length > 0) {
        await tx.personParent.createMany({
          data: parentLinks.map((l) => ({
            childId: person.id,
            parentId: l.parentId,
            role: l.role,
          })),
        });
      }

      await tx.pendingEdit.create({
        data: {
          personId: person.id,
          requestType: "ADD_PERSON",
          submittedBy: user.id,
        },
      });

      return person.id;
    });

    return NextResponse.json(
      { personId, status: PersonStatus.PENDING },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/people failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
