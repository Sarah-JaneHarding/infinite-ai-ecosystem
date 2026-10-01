import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'INFINITE-AI', template: '%s | INFINITE-AI' },
  description: 'AI-powered education platform for South African schools.',
  robots: 'noindex, nofollow',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  // Wait for a real request before rendering. `proxy.ts` issues a fresh CSP nonce per
  // request and Next.js only stamps it onto scripts during server-side rendering; a page
  // prerendered at build time has no request, so its scripts carry no nonce and the
  // browser blocks them all. Awaiting here makes every route under this layout dynamic.
  await connection();
  return (
    <html lang="en-ZA">
      <body>
        <a href="#main" className="skip-to-content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
