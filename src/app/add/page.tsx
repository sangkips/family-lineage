import RegisterPage from "@/components/chrome/RegisterPage";
import SubmissionForm from "@/components/submit/SubmissionForm";
import { PersonStatus } from "@/generated/prisma/client";
import { spousesOf } from "@/lib/household";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * /add — the public front door. No sign-in: anyone in the family can add
 * themselves or a relative, and an admin approves it before it goes live.
 */
export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  // Optional parent pre-selected by "Add child under …" on a person's card.
  const { parentId } = await searchParams;
  let initialParent: {
    id: string;
    name: string;
    gender: "MALE" | "FEMALE" | "OTHER" | null;
  } | null = null;
  if (parentId) {
    const parent = await prisma.person.findFirst({
      where: { id: parentId, status: PersonStatus.APPROVED, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, gender: true },
    });
    if (parent) {
      initialParent = {
        id: parent.id,
        name: `${parent.firstName} ${parent.lastName}`,
        gender: parent.gender,
      };
    }
  }

  // A child born into a household belongs to both partners, so the spouse is
  // offered without anyone having to search for them. With more than one
  // marriage on record the choice is shown rather than guessed.
  const spouses = initialParent ? await spousesOf(prisma, initialParent.id) : [];
  const spouseOptions = spouses.map((spouse) => ({
    id: spouse.id,
    name: `${spouse.firstName} ${spouse.lastName}`,
    gender: spouse.gender,
  }));

  return (
    <RegisterPage
      hem="contribute"
      eyebrow={initialParent ? "Add a child" : "New entry"}
      title={
        initialParent
          ? `Add a child under ${initialParent.name}`
          : "Add yourself or a relative"
      }
      intro={
        initialParent
          ? "Their parents are already known. Just their own details are needed."
          : "Say who they are and who their parents are. Everything else can be filled in later."
      }
      jina="Nothing appears on the tree until an admin approves it."
    >
      <SubmissionForm initialParent={initialParent} spouseOptions={spouseOptions} />
    </RegisterPage>
  );
}
