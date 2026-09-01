import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { SchoolOnboardingWizard } from '@/components/admin/setup/SchoolOnboardingWizard';

export const metadata: Metadata = { title: 'School Setup' };

export default async function SchoolSetupPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/');
  return (
    <section aria-labelledby="setup-heading" className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--iai-text-subtle)] mb-1">
          School Administration
        </p>
        <h1
          id="setup-heading"
          className="text-3xl font-bold text-[var(--iai-text)]"
          style={{ fontFamily: 'var(--iai-font-title)' }}
        >
          School Setup
        </h1>
        <p className="mt-2 text-sm text-[var(--iai-text-subtle)] max-w-xl">
          Configure your school's language settings, CAPS subjects, grade allocations,
          term weeks, and staff. This enables the Curriculum Engine and Learning Analytics
          module.
        </p>
      </div>
      <SchoolOnboardingWizard />
    </section>
  );
}
