import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/auth';
import { AssistantChat } from '@/components/assistant/AssistantChat';
import { listAvailableAssistants } from '@/lib/assistant-chat';
import { assistantDeps } from '@/lib/assistant-runtime';
import { roleMayReach } from '@/lib/route-access';

export const metadata: Metadata = { title: 'AI Assistant' };

export default async function AssistantPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role === null || !roleMayReach(session.role, '/assistant')) redirect('/');

  const { fetchImpl, gatewayBaseUrl } = assistantDeps();
  const assistants = await listAvailableAssistants({ fetchImpl, gatewayBaseUrl });
  return <AssistantChat assistants={assistants} />;
}
