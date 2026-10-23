import { describe, it, expect } from 'vitest';

import { GET } from '../../src/app/api/health/route.js';

// The healthcheck must reflect that the app is serving — not be satisfied by a redirect.
describe('GET /api/health', () => {
  it('answers 200 with a constant body and no caching', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('carries nothing but the status — no environment, tenant or build detail', async () => {
    const body: unknown = await GET().json();

    expect(Object.keys(body as Record<string, unknown>)).toEqual(['status']);
  });
});
