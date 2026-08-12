import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { ApprovalDetail } from '@/components/approval/ApprovalDetail';

export const metadata: Metadata = { title: 'Review artefact' };

interface Props {
  readonly params: Promise<{ id: string }>;
}

export default async function ApprovalPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  const { id } = await params;
  return <ApprovalDetail id={id} role={session.role} />;
}
