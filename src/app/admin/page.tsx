import { redirect } from "next/navigation";
import Link from "next/link";
import AdminActions from "@/components/admin/AdminActions";
import { UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile || profile.role !== UserRole.ADMIN) {
    redirect("/");
  }

  const pending = await prisma.pendingEdit.findMany({
    where: { decision: null },
    include: {
      person: {
        select: {
          firstName: true,
          lastName: true,
          maidenName: true,
          gender: true,
          birthDate: true,
          birthPlace: true,
        },
      },
    },
    orderBy: { submittedAt: "desc" },
    take: 50,
  });

  return (
    <main className="min-h-dvh bg-[#0d1117] px-6 py-10 text-gray-100">
      <div className="mx-auto w-full max-w-3xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>
        <h1 className="mt-4 text-2xl font-bold">Moderation queue</h1>
        <p className="mt-1 text-sm text-gray-400">
          Approve or reject pending entries. Approved people appear in the
          public tree.
        </p>

        {pending.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-gray-800 bg-[#161b22] p-8 text-center text-sm text-gray-400">
            🎉 Nothing waiting for review.
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {pending.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-[#161b22] p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-100">
                    {e.person.firstName} {e.person.lastName}
                    {e.person.maidenName && (
                      <span className="ml-1 font-normal text-gray-500">
                        (née {e.person.maidenName})
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {e.requestType}
                    {e.person.gender ? ` · ${e.person.gender.toLowerCase()}` : ""}
                    {e.person.birthDate
                      ? ` · b. ${e.person.birthDate.getFullYear()}`
                      : ""}
                    {e.person.birthPlace ? ` · ${e.person.birthPlace}` : ""}
                  </p>
                </div>
                <AdminActions editId={e.id} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
