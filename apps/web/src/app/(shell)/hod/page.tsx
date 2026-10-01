import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { HodConsole } from '@/components/hod/HodConsole';
import { loadApprovalQueue } from '@/lib/approvals-loader';

export const metadata: Metadata = { title: 'HoD Console' };

export default async function HodPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'hod') redirect('/');

  // The tenant and actor come from the verified session only (rule 5). Without both there
  // is nothing safe to read, so the list is "unavailable" rather than a guessed empty one.
  const pending =
    session.tenantId !== '' && session.userId !== ''
      ? await loadApprovalQueue(
          { tenantId: session.tenantId, actorId: session.userId },
          session.role,
        )
      : null;

  return <HodConsole pending={pending} />;
}
