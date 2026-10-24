import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Security test (OQ-033): a human-gate decision is recorded under the school's own account id,
// never the identity provider's `sub`; and a session with no resolved account cannot decide.
const { getToken, withTenant, decideHumanGate } = vi.hoisted(() => ({
  getToken: vi.fn(),
  withTenant: vi.fn(),
  decideHumanGate: vi.fn(),
}));

vi.mock('next-auth/jwt', () => ({ getToken }));
vi.mock('@infinite-ai/db', () => ({ withTenant }));
vi.mock('@infinite-ai/orchestrator', () => ({
  decideHumanGate,
  OrchestratorRunnerError: class OrchestratorRunnerError extends Error {},
}));
vi.mock('../../src/lib/env', () => ({ getWebEnv: () => ({ NEXTAUTH_SECRET: 'x' }) }));

import { POST } from '../../src/app/api/approvals/[id]/decide/route.js';

const TENANT = '10000000-0000-4000-8000-000000000001';
const SUB = '5b1a0000-0000-4000-8000-0000000000aa';
const ACCOUNT = 'acc00000-0000-4000-8000-000000000001';
const TX = { tx: true };

function call(): Promise<Response> {
  const request = new NextRequest('http://localhost/api/approvals/t1/decide', {
    method: 'POST',
    body: JSON.stringify({ runId: 'r1', outcome: 'APPROVED', reason: 'Looks right.' }),
  });
  return POST(request, { params: Promise.resolve({ id: 't1' }) });
}

describe('POST /api/approvals/[id]/decide', () => {
  beforeEach(() => {
    getToken.mockReset();
    withTenant.mockReset();
    decideHumanGate.mockReset();
    withTenant.mockImplementation((_ctx, fn: (tx: unknown) => unknown) => fn(TX));
    decideHumanGate.mockResolvedValue(undefined);
  });

  it('decides as the resolved account id — the same id in the context and the decision', async () => {
    getToken.mockResolvedValue({ sub: SUB, tenantId: TENANT, userId: ACCOUNT });
    const response = await call();
    expect(response.status).toBe(200);
    expect(withTenant).toHaveBeenCalledWith(
      { tenantId: TENANT, actorId: ACCOUNT },
      expect.any(Function),
    );
    expect(decideHumanGate).toHaveBeenCalledWith(
      TX,
      'r1',
      expect.objectContaining({ decidedBy: ACCOUNT, outcome: 'APPROVED' }),
    );
  });

  it('refuses a session that has only the provider subject, and decides nothing', async () => {
    getToken.mockResolvedValue({ sub: SUB, tenantId: TENANT });
    const response = await call();
    expect(response.status).toBe(403);
    expect(withTenant).not.toHaveBeenCalled();
    expect(decideHumanGate).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated caller with 401', async () => {
    getToken.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(decideHumanGate).not.toHaveBeenCalled();
  });
});
