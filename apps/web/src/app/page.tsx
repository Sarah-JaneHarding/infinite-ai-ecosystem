import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { ROLE_HOME } from '@/lib/roles';
import type { Role } from '@infinite-ai/policy';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  const role = session.role as Role;
  redirect(ROLE_HOME[role]);
}
