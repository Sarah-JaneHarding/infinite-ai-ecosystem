import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Infinite AI Ecosystem', template: '%s | Infinite AI Ecosystem' },
  description:
    'Multi-tenant, POPIA-safe education platform for South African schools, featuring role-based dashboards, curriculum planning, and learning analytics.',
  robots: 'noindex, nofollow',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { readonly children: React.ReactNode }) {
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
