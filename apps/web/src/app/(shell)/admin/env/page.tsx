import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { EnvDocs } from '@/components/admin/EnvDocs';

export const metadata: Metadata = { title: 'Environment Variables' };

export default async function AdminEnvPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin' && session.role !== 'platform_admin') {
    redirect('/');
  }

  return <EnvDocs />;
}
