import { NextRequest, NextResponse } from "next/server";
import { DatePrecision, Gender, Prisma } from "@/generated/prisma/client";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type EditPersonBody = {
  firstName?: string;
  lastName?: string;
  maidenName?: string | null;
  gender?: Gender | null;
  birthDate?: string | null;
  birthDatePrecision?: DatePrecision;
  deathDate?: string | null;
  birthPlace?: string | null;
  deathPlace?: string | null;
  bio?: string | null;
  isLiving?: boolean;
  /** Privacy toggles — only meaningful for living people. */
  hideBirthDate?: boolean;
  hideFullName?: boolean;
};

/**
 * PATCH /api/people/[id] — admin edits a person already in the register.
 *
 * Contributors no longer hold accounts, so there is no self-service editing:
 * corrections arrive through `POST /api/submissions` as EDIT_PERSON requests
 * and land here only once an admin approves them. This endpoint is the
 * admin's own hand — fixing records and setting the privacy toggles for
 * living people.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: EditPersonBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const data: Prisma.PersonUpdateInput = {};
  if (body.firstName !== undefined) {
    const value = body.firstName.trim();
    if (!value) return NextResponse.json({ error: "firstName cannot be empty" }, { status: 400 });
    data.firstName = value;
  }
  if (body.lastName !== undefined) {
    const value = body.lastName.trim();
    if (!value) return NextResponse.json({ error: "lastName cannot be empty" }, { status: 400 });
    data.lastName = value;
  }
  if (body.maidenName !== undefined) data.maidenName = body.maidenName?.trim() || null;
  if (body.gender !== undefined) data.gender = body.gender;
  if (body.birthPlace !== undefined) data.birthPlace = body.birthPlace?.trim() || null;
  if (body.deathPlace !== undefined) data.deathPlace = body.deathPlace?.trim() || null;
  if (body.bio !== undefined) data.bio = body.bio?.trim() || null;
  if (body.isLiving !== undefined) data.isLiving = body.isLiving;
  if (body.hideBirthDate !== undefined) data.hideBirthDate = body.hideBirthDate;
  if (body.hideFullName !== undefined) data.hideFullName = body.hideFullName;
  if (body.birthDatePrecision !== undefined) {
    data.birthDatePrecision = body.birthDatePrecision;
  }

  for (const key of ["birthDate", "deathDate"] as const) {
    const value = body[key];
    if (value === undefined) continue;
    if (value === null) {
      data[key] = null;
      continue;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: `${key} is invalid` }, { status: 400 });
    }
    data[key] = parsed;
  }

  try {
    const person = await prisma.person.update({ where: { id }, data });
    return NextResponse.json({
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      maidenName: person.maidenName,
      gender: person.gender,
      birthDate: person.birthDate?.toISOString() ?? null,
      birthDatePrecision: person.birthDatePrecision,
      deathDate: person.deathDate?.toISOString() ?? null,
      birthPlace: person.birthPlace,
      deathPlace: person.deathPlace,
      bio: person.bio,
      isLiving: person.isLiving,
      hideBirthDate: person.hideBirthDate,
      hideFullName: person.hideFullName,
      status: person.status,
    });
  } catch (error) {
    console.error("PATCH /api/people/[id] failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
