import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { RunInspector } from '@/components/platform/RunInspector';

export const metadata: Metadata = { title: 'Run Inspector' };

export default async function RunsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  const allowed = ['platform_support', 'platform_admin'] as const;
  if (!allowed.includes(session.role as (typeof allowed)[number])) redirect('/');
  return <RunInspector />;
}
