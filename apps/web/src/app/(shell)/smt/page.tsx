import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { SmdDashboard } from '@/components/smt/SmdDashboard';

export const metadata: Metadata = { title: 'SMT Dashboard' };

export default async function SmtPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'smt') redirect('/');
  return <SmdDashboard />;
}
