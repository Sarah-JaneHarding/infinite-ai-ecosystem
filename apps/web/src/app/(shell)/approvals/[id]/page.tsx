import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { ApprovalDetail } from '@/components/approval/ApprovalDetail';

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
  // runId is required — approval URLs must include it (supplied by the worker notification).
  if (runId === undefined) notFound();
  return <ApprovalDetail id={id} runId={runId} role={session.role} />;
}
