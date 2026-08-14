import Header from "@/components/auth/Header";
import TreeCanvas from "@/components/tree/TreeCanvas";
import { getTree } from "@/lib/tree";

// The tree is read live from the database on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getTree();

  return (
    <main className="flex h-dvh flex-col bg-[#0d1117] text-gray-100">
      <Header peopleCount={data.people.length} linkCount={data.links.length} />
      <div className="min-h-0 flex-1">
        <TreeCanvas data={data} />
      </div>
    </main>
  );
}
