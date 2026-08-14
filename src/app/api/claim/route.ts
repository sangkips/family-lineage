import { NextRequest, NextResponse } from "next/server";
import { Gender, ParentRole, PersonStatus, UserRole } from "@/generated/prisma/client";
import { getUserFromRequest } from "@/lib/auth";
import { notifyAdminsOfPending } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler";
import {
  assertNoCycle,
  CycleValidationError,
  findPotentialDuplicates,
} from "@/lib/validation";

type ParentLinkInput = {
  parentId: string;
  role: ParentRole;
};

type ClaimBody = {
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
 * POST /api/claim — a signed-in member claims their place in the tree by
 * submitting themselves as a child of 1-2 parents. The person is created as
 * PENDING (hidden from the public tree) with a PendingEdit for admin review.
 * The member's Profile (role MEMBER/ADMIN) is bound to the new node.
 *
 * Auth: Supabase session from cookies, or `Authorization: Bearer <token>`.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.json({});
  const supabase = createRouteHandlerSupabaseClient(request, response);

  // --- Authenticate (bearer token or cookie session) ---
  const user = await getUserFromRequest(request, supabase);
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // --- Parse & validate the body ---
  let body: ClaimBody;
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
    // --- One claim per account ---
    const existingProfile = await prisma.profile.findUnique({
      where: { userId: user.id },
    });
    if (existingProfile) {
      return NextResponse.json(
        { error: "You have already claimed a place in the tree." },
        { status: 409 }
      );
    }

    // --- Warn about likely duplicates (admin still decides) ---
    const duplicates = await findPotentialDuplicates({
      firstName,
      lastName,
      birthDate,
    });

    // --- Parents must exist and be approved ---
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

    // --- Create the pending person, links, edit request and profile ---
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

      // A brand-new person is a leaf, so this can't trip today — but it
      // guards the same DAG invariant against future re-link endpoints.
      await assertNoCycle(
        tx,
        person.id,
        parentLinks.map((l) => l.parentId)
      );

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

      // First account in the tree becomes admin; ADMIN_EMAILS also grants it.
      const profileCount = await tx.profile.count();
      const email = user.email?.toLowerCase() ?? "";
      const adminEmails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const role =
        profileCount === 0 || adminEmails.includes(email)
          ? UserRole.ADMIN
          : UserRole.MEMBER;

      await tx.profile.create({
        data: { userId: user.id, personId: person.id, role },
      });

      return person.id;
    });

    // Fire-and-forget: notify admins a claim is waiting (never blocks/fails
    // the response — failures are logged inside the helper).
    void notifyAdminsOfPending({
      personName: `${firstName} ${lastName}`.trim(),
      requestType: "ADD_PERSON",
      submittedBy: user.email,
      adminUrl: new URL("/admin", request.url).toString(),
    });

    return NextResponse.json(
      {
        personId,
        status: PersonStatus.PENDING,
        // Informational: people who look like duplicates already in the tree.
        duplicates: duplicates.map((d) => ({
          id: d.id,
          firstName: d.firstName,
          lastName: d.lastName,
          birthDate: d.birthDate?.toISOString() ?? null,
          status: d.status,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof CycleValidationError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("POST /api/claim failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
