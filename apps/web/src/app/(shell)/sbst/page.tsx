import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { SbstCasebook } from '@/components/sbst/SbstCasebook';

export const metadata: Metadata = { title: 'SBST Casebook' };

export default async function SbstPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'sbst') redirect('/');
  return <SbstCasebook />;
}
