import type { Metadata } from 'next';
import { COLORS } from '@infinite-ai/design-system';
import { SignInForm } from '@/components/auth/SignInForm';

export const metadata: Metadata = { title: 'Sign in' };

// What the identity provider's `?error=` code means to a person. The code comes from the URL,
// so it only ever selects one of these strings; it is never rendered.
const SIGN_IN_ERRORS: Readonly<Record<string, string>> = {
  AccessDenied:
    'Your account is not set up for INFINITE-AI yet: it has no role. Ask your school administrator to assign you one, then sign in again.',
};
const GENERIC_SIGN_IN_ERROR = 'Sign-in did not complete. Please try again.';

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await searchParams;
  const message =
    typeof error === 'string' ? (SIGN_IN_ERRORS[error] ?? GENERIC_SIGN_IN_ERROR) : null;

  return (
    <main
      id="main"
      className="min-h-dvh flex items-center justify-center p-4 bg-[var(--iai-bg-subtle)]"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {/* Inline SVG avoids a component import that needs React context */}
            <svg
              role="img"
              aria-label="Infinite AI"
              width="80"
              height="40"
              viewBox="0 0 80 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={COLORS.red} />
                  <stop offset="50%" stopColor={COLORS.blue} />
                  <stop offset="100%" stopColor={COLORS.violet} />
                </linearGradient>
              </defs>
              <circle
                cx="20"
                cy="20"
                r="19"
                stroke="url(#sg)"
                strokeWidth="3"
                fill="none"
              />
              <circle
                cx="60"
                cy="20"
                r="19"
                stroke="url(#sg)"
                strokeWidth="3"
                fill="none"
              />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold text-[var(--iai-text)]"
            style={{ fontFamily: 'var(--iai-font-title)' }}
          >
            INFINITE-AI
          </h1>
          <p className="mt-1 text-sm text-[var(--iai-text-subtle)]">
            Educate · Innovate · Transform
          </p>
        </div>
        {message !== null && (
          <p
            role="alert"
            className="mb-4 rounded-[var(--iai-radius-md)] border border-[var(--iai-error-border)] bg-[var(--iai-error-bg)] p-3 text-sm text-[var(--iai-error-text)]"
          >
            {message}
          </p>
        )}
        <SignInForm />
      </div>
    </main>
  );
}
