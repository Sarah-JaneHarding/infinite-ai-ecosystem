import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { LearnerSpace } from '@/components/learner/LearnerSpace';

export const metadata: Metadata = { title: 'Learner Space' };

export default async function LearnerPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'learner') redirect('/');
  return <LearnerSpace />;
}
