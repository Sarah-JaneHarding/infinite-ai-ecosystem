import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { ROLE_HOME } from '@/lib/roles';

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  // Eligible for several roles and none chosen yet: the chooser decides, never a default.
  if (session.role === null) redirect('/choose-role');
  redirect(ROLE_HOME[session.role]);
}
