import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/SignInForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
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
                  <stop offset="0%" stopColor="#e4483f" />
                  <stop offset="50%" stopColor="#1565c0" />
                  <stop offset="100%" stopColor="#7b2fbe" />
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
        <SignInForm />
      </div>
    </main>
  );
}
