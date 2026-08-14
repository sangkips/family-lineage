import { redirect } from "next/navigation";
import Link from "next/link";
import ChildWizard from "@/components/claim/ChildWizard";
import { PersonStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AddChildPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Optional preselected parent from the "Add child" button in the drawer.
  const { parentId } = await searchParams;
  let initialParent: { id: string; name: string } | null = null;
  if (parentId) {
    const parent = await prisma.person.findFirst({
      where: { id: parentId, status: PersonStatus.APPROVED, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
    });
    if (parent) {
      initialParent = {
        id: parent.id,
        name: `${parent.firstName} ${parent.lastName}`,
      };
    }
  }

  return (
    <main className="min-h-dvh bg-[#0d1117] px-4 py-10 text-gray-100">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>
        <ChildWizard mode="add" initialParent={initialParent} />
      </div>
    </main>
  );
}
