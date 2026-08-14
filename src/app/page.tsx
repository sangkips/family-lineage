import Header from "@/components/auth/Header";
import TreeCanvas from "@/components/tree/TreeCanvas";
import { getTree, resolveViewer } from "@/lib/tree";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// The tree is read live from the database on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Signed-in members see their own PENDING ghost nodes (admins see all).
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const viewer = user ? await resolveViewer(user.id) : null;
  const data = await getTree({ viewer });

  return (
    <main className="flex h-dvh flex-col bg-[#0d1117] text-gray-100">
      <Header peopleCount={data.people.length} linkCount={data.links.length} />
      <div className="min-h-0 flex-1">
        <TreeCanvas data={data} viewerPersonId={viewer?.personId ?? null} />
      </div>
    </main>
  );
}
