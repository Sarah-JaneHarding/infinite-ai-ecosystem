import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { InviteForm } from '@/components/admin/staff/InviteForm';
import { StaffOverview } from '@/components/admin/staff/StaffOverview';
import { loadStaff } from '@/lib/staff-loader';

export const metadata: Metadata = { title: 'Staff' };

// OQ-033 delivery step 5: who has an account at this school, what they hold, and what is waiting.
// Slice b adds inviting a person and revoking an invitation; slice c adds giving and removing roles
// and confirming, declining or cancelling a request. Suspension arrives as a later slice. Every
// action is a route behind the provisioning rules, which decide who may do what.
export default async function StaffPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/');

  // Tenant and actor come from the verified session only (rule 5).
  const overview = await loadStaff({
    tenantId: session.tenantId,
    actorId: session.userId,
  });

  return (
    <section aria-labelledby="staff-heading" className="max-w-5xl mx-auto py-8 px-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--iai-text-subtle)] mb-1">
        School Administration
      </p>
      <h1
        id="staff-heading"
        className="text-3xl font-bold text-[var(--iai-text)] mb-6"
        style={{ fontFamily: 'var(--iai-font-title)' }}
      >
        Staff
      </h1>
      <div className="flex flex-col gap-10">
        <InviteForm />
        <StaffOverview overview={overview} />
      </div>
    </section>
  );
}
