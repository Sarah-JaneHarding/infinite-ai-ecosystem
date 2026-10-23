import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { ApprovalDetail } from '@/components/approval/ApprovalDetail';
import { loadApproval } from '@/lib/approvals-loader';

export const metadata: Metadata = { title: 'Review artefact' };

interface Props {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ApprovalPage({ params, searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  const { id } = await params;
  const sp = await searchParams;
  const runId = typeof sp['runId'] === 'string' ? sp['runId'] : undefined;
  // runId is required — approval URLs must include it (the queue links supply it).
  if (runId === undefined) notFound();
  // Tenant and actor come from the verified session only (rule 5).
  if (session.tenantId === '' || session.userId === '') notFound();

  // The artefact on screen is the stored one, for this tenant, still undecided, waiting on
  // this role, with the run it claims. Anything else is "not found" — a person must never
  // approve something other than what the gate holds (rule 6).
  const approval = await loadApproval(
    { tenantId: session.tenantId, actorId: session.userId },
    session.role,
    id,
    runId,
  );
  if (approval === null) notFound();
  return <ApprovalDetail approval={approval} />;
}
