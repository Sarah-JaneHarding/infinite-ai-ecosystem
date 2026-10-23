import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { ApprovalQueue } from '@/components/approval/ApprovalQueue';
import { loadApprovalQueue } from '@/lib/approvals-loader';

export const metadata: Metadata = { title: 'Approvals' };

// The roles that can have a human gate waiting on them. Mirrors the /approvals rule in
// `lib/route-access.ts` (a test keeps the two equal). Anyone else has no queue.
const APPROVAL_ROLES: ReadonlyArray<string> = ['teacher', 'hod', 'smt', 'sbst', 'admin'];

export default async function ApprovalsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (!APPROVAL_ROLES.includes(session.role)) redirect('/');

  // Tenant and actor come from the verified session only. Without both there is nothing
  // safe to read, so show an empty queue instead of querying.
  const items =
    session.tenantId !== '' && session.userId !== ''
      ? await loadApprovalQueue(
          { tenantId: session.tenantId, actorId: session.userId },
          session.role,
        )
      : [];

  return <ApprovalQueue items={items} role={session.role} />;
}
