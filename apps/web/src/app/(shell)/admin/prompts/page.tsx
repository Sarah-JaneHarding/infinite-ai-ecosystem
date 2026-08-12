import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/auth';
import { PromptBuilder } from '@/components/admin/PromptBuilder';

export const metadata: Metadata = { title: 'Prompt Builder' };

export default async function PromptsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== 'admin') redirect('/');
  return <PromptBuilder />;
}
