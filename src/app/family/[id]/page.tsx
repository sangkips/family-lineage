import Link from "next/link";
import { notFound } from "next/navigation";
import RegisterPage from "@/components/chrome/RegisterPage";
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
    <ul className="mt-2.5 space-y-1.5">
      {people.map((person) => (
        <li key={person.id}>
          <Link href={`/?focus=${person.id}`} className="list-row text-[15px]">
            <span className="truncate">
              {person.firstName} {person.lastName}
            </span>
            <span className="tnum shrink-0 text-xs text-ink-soft">
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
    <RegisterPage
      eyebrow="Household"
      title={`${marriage.partnerA.firstName} ${marriage.partnerA.lastName} and ${marriage.partnerB.firstName} ${marriage.partnerB.lastName}`}
      intro={
        <>
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
        </>
      }
      jina="Every child of the house, down to great-grandchildren."
    >
      <section className="grid gap-3 sm:grid-cols-2">
        {partners.map((partner) => (
          <Link key={partner.id} href={`/?focus=${partner.id}`} className="card block p-4">
            <p className="section-heading">
              {partner.firstName} {partner.lastName}
            </p>
            {partner.maidenName && (
              <p className="mt-0.5 text-[13px] text-ink-soft">née {partner.maidenName}</p>
            )}
            <p className="tnum mt-1 text-[13px] text-ink-soft">{lifespan(partner)}</p>
            {partner.birthPlace && (
              <p className="mt-0.5 text-[13px] text-ink-soft">{partner.birthPlace}</p>
            )}
          </Link>
        ))}
      </section>

      {generations.length === 0 ? (
        <p className="card mt-8 p-6 text-center text-[15px] text-ink-soft">
          No children recorded for the two of them together. Open either name on the
          tree to add one.
        </p>
      ) : (
        <div className="mt-8 space-y-7">
          {generations.map((generation) => (
            <section key={generation.title}>
              <h2 className="section-heading">
                {generation.title}
                <span className="tnum ml-2 font-normal text-ink-soft">
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
        <section key={group.partnerId} className="mt-7">
          <h2 className="section-heading">
            {group.partnerName.split(" ")[0]}&apos;s children from another relationship
            <span className="tnum ml-2 font-normal text-ink-soft">
              {group.people.length}
            </span>
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft">
            Recorded under {group.partnerName} only — the other parent is someone
            else, or is not recorded.
          </p>
          <MemberList people={group.people} />
        </section>
      ))}
    </RegisterPage>
  );
}
