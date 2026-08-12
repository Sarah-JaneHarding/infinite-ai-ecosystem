import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { GuardianPortal } from '@/components/guardian/GuardianPortal';

export const metadata: Metadata = { title: 'Parent Portal' };

export default async function GuardianPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'guardian') redirect('/');
  return <GuardianPortal />;
}
