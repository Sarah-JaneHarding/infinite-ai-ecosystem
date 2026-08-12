'use client';

import { signIn } from 'next-auth/react';

export function SignInForm() {
  return (
    <div className="rounded-[var(--iai-radius-xl)] bg-[var(--iai-bg)] border border-[var(--iai-border)] shadow-[var(--iai-shadow-md)] p-8">
      <p className="text-sm text-[var(--iai-text-subtle)] text-center mb-6">
        Sign in with your school account.
      </p>
      <button
        type="button"
        onClick={() => void signIn('keycloak')}
        className="w-full py-2.5 px-4 rounded-[var(--iai-radius-md)] bg-[var(--iai-primary)] text-white text-sm font-medium hover:bg-[var(--iai-primary-deep)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--iai-primary)] focus-visible:ring-offset-2"
      >
        Sign in with Keycloak
      </button>
      <p className="mt-4 text-xs text-center text-[var(--iai-text-subtle)]">
        <strong>AI drafts; the teacher decides.</strong>
      </p>
    </div>
  );
}
