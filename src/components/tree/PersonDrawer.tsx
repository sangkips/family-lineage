"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { PersonDTO } from "@/lib/tree";

type Props = {
  person: PersonDTO;
  parents: PersonDTO[];
  children: PersonDTO[];
  /** The viewer's own claimed node id, if any. */
  ownPersonId?: string | null;
  onClose: () => void;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Unknown";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-right text-gray-200">{value}</span>
    </div>
  );
}

function RelativeList({ label, people }: { label: string; people: PersonDTO[] }) {
  if (people.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </h3>
      <ul className="space-y-1">
        {people.map((p) => (
          <li key={p.id} className="text-sm text-gray-200">
            {p.firstName} {p.lastName}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PersonDrawer({
  person,
  parents,
  children,
  ownPersonId,
  onClose,
}: Props) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const isOwnNode = signedIn && ownPersonId === person.id;

  useEffect(() => {
    let cancelled = false;
    createBrowserSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) setSignedIn(!!data.session);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="absolute right-0 top-0 z-10 flex h-full w-80 flex-col border-l border-gray-800 bg-[#0d1117]/95 backdrop-blur">
      <div className="flex items-start justify-between border-b border-gray-800 p-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">
            {person.firstName} {person.lastName}
            {person.maidenName && (
              <span className="ml-1 text-sm font-normal text-gray-400">
                (née {person.maidenName})
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500">
            {person.isLiving ? "Living" : "Deceased"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md px-2 py-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
          aria-label="Close details"
        >
          ✕
        </button>
      </div>

      {person.status === "PENDING" && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300">
          ⏳ Pending approval — this entry is only visible to you (and admins)
          until it&apos;s approved.
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <Row label="Birth" value={formatDate(person.birthDate)} />
        {person.birthPlace && <Row label="Birthplace" value={person.birthPlace} />}
        {!person.isLiving && <Row label="Death" value={formatDate(person.deathDate)} />}
        {person.bio && (
          <p className="mt-3 border-t border-gray-800 pt-3 text-sm leading-relaxed text-gray-300">
            {person.bio}
          </p>
        )}
        <RelativeList label="Parents" people={parents} />
        <RelativeList label="Children" people={children} />
      </div>

      {signedIn && (
        <div className="space-y-2 border-t border-gray-800 p-4">
          {isOwnNode && (
            <button
              onClick={() => router.push("/profile")}
              className="w-full rounded-lg bg-[#58a6ff] px-3 py-2 text-sm font-semibold text-[#0d1117] transition-opacity hover:opacity-90"
            >
              ✎ Edit your profile
            </button>
          )}
          <button
            onClick={() => router.push(`/add?parentId=${person.id}`)}
            className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition-opacity hover:opacity-90 ${
              isOwnNode
                ? "border border-gray-700 bg-[#161b22] text-gray-300 hover:border-gray-600 hover:text-gray-100"
                : "bg-[#58a6ff] text-[#0d1117]"
            }`}
          >
            ＋ Add child under {person.firstName}
          </button>
        </div>
      )}
    </aside>
  );
}
