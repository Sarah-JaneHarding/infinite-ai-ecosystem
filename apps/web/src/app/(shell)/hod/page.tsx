import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { HodConsole } from '@/components/hod/HodConsole';

export const metadata: Metadata = { title: 'HoD Console' };

export default async function HodPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'hod') redirect('/');
  return <HodConsole />;
}
