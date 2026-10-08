import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

// The header used to be handed `session.tenantId` as the school's name, so every signed-in
// user read a UUID at the top of every page. It must get the name, and never the id.
const { getServerSession, redirect, loadTenantLabel } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
  loadTenantLabel: vi.fn(),
}));

vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/tenant-name-loader', () => ({ loadTenantLabel }));
vi.mock('@/components/shell/Header', () => ({ Header: () => null }));
vi.mock('@/components/shell/Nav', () => ({ Nav: () => null }));
vi.mock('@/components/shell/ImpersonationBanner', () => ({
  ImpersonationBanner: () => null,
}));

import ShellLayout from '../../src/app/(shell)/layout.js';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const SESSION = {
  role: 'teacher',
  tenantId: TENANT_ID,
  userId: 'sub-1',
  user: { name: 'T. Teacher' },
};

/** Finds the element whose props carry `tenantName`, wherever it sits in the tree. */
function headerProps(node: unknown): Record<string, unknown> | null {
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = headerProps(child);
      if (found) return found;
    }
    return null;
  }
  const props = (node as ReactElement).props as Record<string, unknown> | undefined;
  if (!props) return null;
  if ('tenantName' in props) return props;
  return headerProps(props['children']);
}

describe('ShellLayout header', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
    loadTenantLabel.mockReset();
  });

  it('shows the school name, looked up for the session’s own tenant and user', async () => {
    getServerSession.mockResolvedValue(SESSION);
    loadTenantLabel.mockResolvedValue('Sunridge Primary');
    const tree = await ShellLayout({ children: null });
    expect(loadTenantLabel).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      actorId: 'sub-1',
    });
    expect(headerProps(tree)?.['tenantName']).toBe('Sunridge Primary');
  });

  it('never hands the header the tenant id', async () => {
    getServerSession.mockResolvedValue(SESSION);
    loadTenantLabel.mockResolvedValue('Infinite AI');
    const tree = await ShellLayout({ children: null });
    expect(headerProps(tree)?.['tenantName']).not.toBe(TENANT_ID);
  });

  it('sends a signed-out caller to sign in without any lookup', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(ShellLayout({ children: null })).rejects.toThrow('REDIRECT:/sign-in');
    expect(loadTenantLabel).not.toHaveBeenCalled();
  });
});
