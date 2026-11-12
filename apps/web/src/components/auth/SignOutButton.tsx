'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: '/sign-in' })}
      className="w-full py-2.5 px-4 rounded-[var(--iai-radius-md)] border border-[var(--iai-border)] text-sm font-medium text-[var(--iai-text)] hover:bg-[var(--iai-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iai-primary)] focus-visible:ring-offset-2"
    >
      Sign out
    </button>
  );
}
