import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { TeacherStudio } from '@/components/teacher/TeacherStudio';

export const metadata: Metadata = { title: 'Teacher Studio' };

export default async function TeacherPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'teacher') redirect('/');
  return <TeacherStudio />;
}
