import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { Header } from '@/components/shell/Header';
import { Nav } from '@/components/shell/Nav';
import { ImpersonationBanner } from '@/components/shell/ImpersonationBanner';
import { ROLE_NAV } from '@/lib/roles';
import type { Role } from '@infinite-ai/policy';

export default async function ShellLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/sign-in');

  const role = session.role as Role;
  const links = ROLE_NAV[role];
  const userName = session.user?.name ?? session.user?.email ?? 'User';
  const tenantName = session.tenantId ?? 'Infinite AI';

  return (
    <div className="flex flex-col min-h-dvh">
      <ImpersonationBanner impersonating={null} />
      <Header role={role} tenantName={tenantName} userName={userName} approvalCount={0} />
      <div className="flex flex-1 overflow-hidden">
        <aside
          className="w-52 shrink-0 border-r border-[var(--iai-border)] bg-[var(--iai-bg-subtle)] p-3 overflow-y-auto hidden md:block"
          aria-label="Sidebar"
        >
          <Nav links={links} />
        </aside>
        <main
          id="main"
          className="flex-1 overflow-y-auto p-4 md:p-6 bg-[var(--iai-bg-subtle)]"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
