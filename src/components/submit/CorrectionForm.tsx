"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useToast } from "@/components/ui/Toast";

type Correctable = {
  id: string;
  firstName: string;
  lastName: string;
  maidenName: string;
  birthYear: string;
  birthPlace: string;
  deathDate: string;
  isLiving: boolean;
  bio: string;
};

const field = "field";
const label = "field-label mb-1";

/**
 * Propose a correction to someone already in the register. Only the fields
 * actually changed are sent, and nothing touches the live person until an
 * admin approves — so a wrong suggestion cannot pull a relative off the tree.
 */
export default function CorrectionForm({ person }: { person: Correctable }) {
  const [values, setValues] = useState<Correctable>(person);
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (patch: Partial<Correctable>) => setValues({ ...values, ...patch });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const changes: Record<string, unknown> = {};
    if (values.firstName.trim() !== person.firstName) changes.firstName = values.firstName;
    if (values.lastName.trim() !== person.lastName) changes.lastName = values.lastName;
    if (values.maidenName.trim() !== person.maidenName) {
      changes.maidenName = values.maidenName;
    }
    if (values.birthPlace.trim() !== person.birthPlace) changes.birthPlace = values.birthPlace;
    if (values.bio.trim() !== person.bio) changes.bio = values.bio;
    if (values.isLiving !== person.isLiving) changes.isLiving = values.isLiving;
    if (values.birthYear !== person.birthYear) {
      changes.birthYear = values.birthYear ? Number(values.birthYear) : null;
    }
    if (values.deathDate !== person.deathDate) {
      changes.deathDate = values.deathDate || null;
    }

    if (Object.keys(changes).length === 0) {
      setError("Nothing has been changed yet.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "EDIT_PERSON", personId: person.id, changes }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Something went wrong");
        toast(body.error ?? "Something went wrong", "error");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please try again");
      toast("Network error — nothing was sent", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="card border-leaf bg-leaf-wash p-5 sm:p-8">
        <p className="eyebrow text-leaf-ink">Sent for review</p>
        <h2 className="title mt-1.5 text-[24px]">Correction sent</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          An admin will compare it with what is recorded and apply it if it is right.
          The entry on the tree is unchanged until then.
        </p>
        <Link href="/" className="btn mt-5">
          Back to the tree
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="card space-y-4 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className={label}>
              First name
            </label>
            <input
              id="firstName"
              value={values.firstName}
              onChange={(e) => set({ firstName: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="lastName" className={label}>
              Last name
            </label>
            <input
              id="lastName"
              value={values.lastName}
              onChange={(e) => set({ lastName: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="maidenName" className={label}>
              Maiden name
            </label>
            <input
              id="maidenName"
              value={values.maidenName}
              onChange={(e) => set({ maidenName: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="birthYear" className={label}>
              Birth year
            </label>
            <input
              id="birthYear"
              inputMode="numeric"
              value={values.birthYear}
              onChange={(e) => set({ birthYear: e.target.value })}
              className={`${field} tnum`}
            />
          </div>
          <div>
            <label htmlFor="birthPlace" className={label}>
              Birthplace
            </label>
            <input
              id="birthPlace"
              value={values.birthPlace}
              onChange={(e) => set({ birthPlace: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label htmlFor="deathDate" className={label}>
              Date of death
            </label>
            <input
              id="deathDate"
              type="date"
              value={values.deathDate}
              onChange={(e) => set({ deathDate: e.target.value, isLiving: false })}
              className={field}
            />
          </div>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-[15px] text-ink">
          <input
            type="checkbox"
            checked={values.isLiving}
            onChange={(e) => set({ isLiving: e.target.checked })}
            className="h-4 w-4 accent-[var(--color-cobalt)]"
          />
          This person is living
        </label>

        <div>
          <label htmlFor="bio" className={label}>
            Notes
          </label>
          <textarea
            id="bio"
            rows={4}
            value={values.bio}
            onChange={(e) => set({ bio: e.target.value })}
            className={`${field} py-2.5`}
          />
        </div>
      </section>

      {error && <p className="notice notice-error">{error}</p>}

      <button type="submit" disabled={submitting} className="btn min-h-12">
        {submitting ? "Sending…" : "Send correction"}
      </button>
    </form>
  );
}
