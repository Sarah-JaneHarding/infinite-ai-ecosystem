import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/auth';
import { CapsCanonConsole } from '@/components/curriculum/CapsCanonConsole';

export const metadata: Metadata = { title: 'CAPS Canon Ingestion Console' };

export default async function CapsCanonPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/');

  return (
    <section aria-labelledby="caps-canon-heading" className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--iai-text-subtle)] mb-1">
          Curriculum Engine · Stage 08 Grounding · L0 Constitution Builder
        </p>
        <h1
          id="caps-canon-heading"
          className="text-3xl font-bold text-[var(--iai-text)]"
          style={{ fontFamily: 'var(--iai-font-title)' }}
        >
          CAPS Canon Ingestion Console
        </h1>
        <p className="mt-2 text-sm text-[var(--iai-text-subtle)] max-w-3xl">
          Register, verify and ratify the 52 CAPS curriculum documents and 3 ATP sets for
          Grades R–7. Every document must be downloaded from the official DBE portal,
          SHA-256 verified, ingested as a Brain write candidate, and ratified by a named
          human before it becomes available to the Curriculum Engine.
        </p>
      </div>
      <CapsCanonConsole />
    </section>
  );
}
