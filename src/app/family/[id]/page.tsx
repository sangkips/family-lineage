import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonStatus } from "@/generated/prisma/client";
import { descendantsOfCouple, type FamilyMember } from "@/lib/family";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function lifespan(person: {
  birthDate: Date | null;
  deathDate: Date | null;
  isLiving: boolean;
  hideBirthDate: boolean;
}): string {
  const birth =
    person.isLiving && person.hideBirthDate
      ? null
      : (person.birthDate?.getUTCFullYear() ?? null);
  if (!person.isLiving && person.deathDate) {
    return `${birth ?? "?"}–${person.deathDate.getUTCFullYear()}`;
  }
  return birth ? `b. ${birth}` : person.isLiving ? "living" : "dates unrecorded";
}

function MemberList({ people }: { people: FamilyMember[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {people.map((person) => (
        <li key={person.id}>
          <Link
            href={`/?focus=${person.id}`}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-gray-800 bg-[#0d1117] px-3 text-sm text-gray-200"
          >
            <span className="truncate">
              {person.firstName} {person.lastName}
            </span>
            <span className="shrink-0 text-xs text-gray-500">
              {person.birthYear ? `b. ${person.birthYear}` : person.isLiving ? "living" : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * /family/[id] — one marriage: both partners, when it began and ended, and
 * their descendants down to great-grandchildren.
 */
export default async function FamilyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const marriage = await prisma.marriage.findFirst({
    where: { id, status: PersonStatus.APPROVED, deletedAt: null },
    include: {
      partnerA: true,
      partnerB: true,
    },
  });

  if (!marriage) notFound();

  const { generations, otherChildren } = await descendantsOfCouple(
    marriage.partnerAId,
    marriage.partnerBId
  );
  const partners = [marriage.partnerA, marriage.partnerB];

  return (
    <main className="min-h-dvh bg-[#0d1117] px-4 py-8 text-gray-100 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm text-[#58a6ff] hover:underline">
          ← Back to tree
        </Link>

        <h1 className="mt-4 text-xl font-bold sm:text-2xl">
          {marriage.partnerA.firstName} {marriage.partnerA.lastName}
          <span className="mx-2 text-gray-500">⚭</span>
          {marriage.partnerB.firstName} {marriage.partnerB.lastName}
        </h1>

        <p className="mt-1 text-sm text-gray-400">
          {marriage.startDate
            ? `Married ${marriage.startDate.getUTCFullYear()}`
            : "Wedding year not recorded"}
          {marriage.endDate &&
            ` · ended ${marriage.endDate.getUTCFullYear()}${
              marriage.endReason === "DEATH"
                ? " by death"
                : marriage.endReason === "DIVORCE"
                  ? " by divorce"
                  : ""
            }`}
        </p>

        <section className="mt-6 grid gap-3 sm:grid-cols-2">
          {partners.map((partner) => (
            <Link
              key={partner.id}
              href={`/?focus=${partner.id}`}
              className="rounded-2xl border border-gray-800 bg-[#161b22] p-4"
            >
              <p className="text-sm font-semibold text-gray-100">
                {partner.firstName} {partner.lastName}
                {partner.maidenName && (
                  <span className="ml-1 font-normal text-gray-400">
                    (née {partner.maidenName})
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{lifespan(partner)}</p>
              {partner.birthPlace && (
                <p className="mt-1 text-xs text-gray-500">{partner.birthPlace}</p>
              )}
            </Link>
          ))}
        </section>

        {generations.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-gray-800 bg-[#161b22] p-6 text-center text-sm text-gray-400">
            No children recorded for the two of them together.
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            {generations.map((generation) => (
              <section key={generation.title}>
                <h2 className="text-sm font-semibold text-gray-200">
                  {generation.title}
                  <span className="ml-2 font-normal text-gray-500">
                    {generation.people.length}
                  </span>
                </h2>
                <MemberList people={generation.people} />
              </section>
            ))}
          </div>
        )}

        {/* Children one partner had elsewhere. Shown so the household reads
            completely, but never counted as the couple's own — a marriage
            does not make someone the parent of a child born before it. */}
        {otherChildren.map((group) => (
          <section key={group.partnerId} className="mt-6">
            <h2 className="text-sm font-semibold text-gray-200">
              {group.partnerName.split(" ")[0]}&apos;s children from another
              relationship
              <span className="ml-2 font-normal text-gray-500">
                {group.people.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Recorded under {group.partnerName} only — the other parent is
              someone else, or is not recorded.
            </p>
            <MemberList people={group.people} />
          </section>
        ))}
      </div>
    </main>
  );
}
