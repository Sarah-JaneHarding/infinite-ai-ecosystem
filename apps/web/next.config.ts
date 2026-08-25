import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Transpile workspace packages so Next.js can process their TypeScript source.
  transpilePackages: ['@infinite-ai/design-system', '@infinite-ai/security'],
  // Stage 16: full security header hardening.
  // Values are inlined here because next.config.ts is loaded by Next.js's own config
  // loader which does not do .js→.ts extension remapping for workspace packages.
  // The authoritative definitions live in packages/security/src/headers.ts; these
  // must stay in sync with them.
  // The Content-Security-Policy nonce is injected per-request by proxy.ts and is
  // not set statically here — a static CSP cannot carry a per-request nonce.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ];
  },
};

export default nextConfig;
