import { NextRequest, NextResponse } from "next/server";
import { Gender } from "@/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";

type EditProfileBody = {
  maidenName?: string;
  gender?: Gender | null;
  birthDate?: string | null;
  deathDate?: string | null;
  birthPlace?: string;
  deathPlace?: string;
  bio?: string;
  isLiving?: boolean;
  /** Privacy toggles — only meaningful for living people. */
  hideBirthDate?: boolean;
  hideFullName?: boolean;
};

/**
 * PATCH /api/people/[id] — a member edits their own claimed node.
 * Ownership is enforced: the account must have a Profile bound to this exact
 * person. Unlike adding people, edits apply immediately (no moderation queue).
 * firstName / lastName are deliberately read-only here — renaming a tree node
 * is identity-sensitive and stays an admin decision.
 */
export async function PATCH(
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

  // --- The member can only edit the node they claimed ---
  const profile = await prisma.profile.findUnique({
    where: { userId: user.id },
  });
  if (!profile) {
    return NextResponse.json(
      { error: "You haven't claimed a place in the tree yet" },
      { status: 403 }
    );
  }
  if (profile.personId !== id) {
    return NextResponse.json(
      { error: "You can only edit your own profile" },
      { status: 403 }
    );
  }

  let body: EditProfileBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const birthDate = body.birthDate ? new Date(body.birthDate) : null;
  if (body.birthDate && Number.isNaN(birthDate!.getTime())) {
    return NextResponse.json({ error: "birthDate is invalid" }, { status: 400 });
  }
  const deathDate = body.deathDate ? new Date(body.deathDate) : null;
  if (body.deathDate && Number.isNaN(deathDate!.getTime())) {
    return NextResponse.json({ error: "deathDate is invalid" }, { status: 400 });
  }

  try {
    const person = await prisma.person.update({
      where: { id },
      data: {
        maidenName: body.maidenName?.trim() || null,
        gender: body.gender ?? null,
        birthDate,
        deathDate,
        birthPlace: body.birthPlace?.trim() || null,
        deathPlace: body.deathPlace?.trim() || null,
        bio: body.bio?.trim() || null,
        isLiving: typeof body.isLiving === "boolean" ? body.isLiving : undefined,
        hideBirthDate:
          typeof body.hideBirthDate === "boolean" ? body.hideBirthDate : undefined,
        hideFullName:
          typeof body.hideFullName === "boolean" ? body.hideFullName : undefined,
      },
    });

    return NextResponse.json({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      maidenName: person.maidenName,
      gender: person.gender,
      birthDate: person.birthDate?.toISOString() ?? null,
      deathDate: person.deathDate?.toISOString() ?? null,
      birthPlace: person.birthPlace,
      deathPlace: person.deathPlace,
      bio: person.bio,
      isLiving: person.isLiving,
      status: person.status,
    });
  } catch (error) {
    console.error("PATCH /api/people failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
