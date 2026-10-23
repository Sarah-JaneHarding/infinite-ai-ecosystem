import { describe, it, expect, vi, beforeEach } from 'vitest';

// The root layout must wait for a real request. `proxy.ts` issues a per-request CSP nonce
// and Next.js only stamps it onto scripts while server-rendering a request; a route
// prerendered at build time carries no nonce, so the browser blocks all of its scripts.
// `next dev` renders everything dynamically, so this only shows up in a production build.
const { connection } = vi.hoisted(() => ({ connection: vi.fn(async () => undefined) }));

vi.mock('next/server', () => ({ connection }));
vi.mock('../../src/app/globals.css', () => ({}));

import RootLayout from '../../src/app/layout.js';

describe('RootLayout', () => {
  beforeEach(() => {
    connection.mockClear();
  });

  it('awaits connection() so every route under it renders per request', async () => {
    await RootLayout({ children: null });

    expect(connection).toHaveBeenCalledTimes(1);
  });

  it('does not render until connection() has resolved', async () => {
    let release: () => void = () => undefined;
    connection.mockImplementationOnce(
      () => new Promise<undefined>((resolve) => (release = () => resolve(undefined))),
    );

    let settled = false;
    const rendering = RootLayout({ children: null }).then((tree) => {
      settled = true;
      return tree;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    release();
    expect(await rendering).toBeTruthy();
  });
});
