import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/auth';
import { RoleChooser } from '@/components/auth/RoleChooser';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { noRoleNotice } from '@/lib/account-notice';

export const metadata: Metadata = { title: 'Choose your role' };

// OQ-032 / PROVISIONING_DESIGN §4.8. The only page a session with no active role can reach (the
// proxy sends everything else here). A session that already has a role has nothing to choose, and
// no role can be switched without signing in again, so it goes home.
export default async function ChooseRolePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');
  if (session.role !== null) redirect('/');

  return (
    <main
      id="main"
      className="min-h-dvh flex items-center justify-center p-4 bg-[var(--iai-bg-subtle)]"
    >
      <div className="w-full max-w-sm">
        {session.eligibleRoles.length === 0 ? (
          <div className="rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] shadow-[var(--iai-shadow-md)] p-8">
            <p role="status" className="text-sm text-[var(--iai-text)] mb-6">
              {noRoleNotice(session.userId, session.accountOutcome)}
            </p>
            <SignOutButton />
          </div>
        ) : (
          <RoleChooser roles={session.eligibleRoles} />
        )}
      </div>
    </main>
  );
}
