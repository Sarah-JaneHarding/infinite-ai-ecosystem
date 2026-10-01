import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { SmdDashboard } from '@/components/smt/SmdDashboard';
import { loadApprovalQueue } from '@/lib/approvals-loader';

export const metadata: Metadata = { title: 'SMT Dashboard' };

export default async function SmtPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'smt') redirect('/');

  // The tenant and actor come from the verified session only (rule 5). Without both there
  // is nothing safe to read, so the count is "unavailable" rather than a guessed zero.
  const pendingApprovals =
    session.tenantId !== '' && session.userId !== ''
      ? (
          await loadApprovalQueue(
            { tenantId: session.tenantId, actorId: session.userId },
            session.role,
          )
        ).length
      : null;

  return <SmdDashboard pendingApprovals={pendingApprovals} />;
}
