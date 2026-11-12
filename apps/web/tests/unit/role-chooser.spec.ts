import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The chooser page (OQ-032): one decision, three states. The client component is stubbed — its one
// job is to call `update({ role })`, and the server-side refusal of a forged role is proven in
// auth-callbacks.spec.ts — so this pins what each state shows and where each state goes.
const { getServerSession, redirect } = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn((to: string): never => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));
vi.mock('next-auth', () => ({ getServerSession }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/auth', () => ({ authOptions: {} }));
vi.mock('@/components/auth/RoleChooser', () => ({
  RoleChooser: ({ roles }: { roles: string[] }) =>
    createElement('div', { 'data-chooser': roles.join(',') }),
}));
vi.mock('@/components/auth/SignOutButton', () => ({
  SignOutButton: () => createElement('button', { 'data-signout': true }),
}));

import ChooseRolePage from '../../src/app/choose-role/page.js';
import { RoleChoice } from '../../src/components/auth/RoleChoice.js';

const USER = '5b1a0000-0000-4000-8000-0000000000aa';
const render = async () => renderToStaticMarkup(await ChooseRolePage());

describe('/choose-role', () => {
  beforeEach(() => {
    getServerSession.mockReset();
    redirect.mockClear();
  });

  it('sends nobody without a session to the chooser', async () => {
    getServerSession.mockResolvedValue(null);
    await expect(render()).rejects.toThrow('REDIRECT:/sign-in');
  });

  it('sends a session that already has a role home — nothing to choose, and no switching', async () => {
    getServerSession.mockResolvedValue({
      role: 'hod',
      eligibleRoles: ['teacher', 'hod'],
      userId: USER,
      accountOutcome: 'existing',
    });
    await expect(render()).rejects.toThrow('REDIRECT:/');
  });

  it('offers the server’s eligible roles, and only those', async () => {
    getServerSession.mockResolvedValue({
      role: null,
      eligibleRoles: ['teacher', 'hod'],
      userId: USER,
      accountOutcome: 'existing',
    });
    const html = await render();
    expect(html).toContain('data-chooser="teacher,hod"');
    expect(html).not.toContain('data-signout');
  });

  it('with no eligible role, explains why and offers only sign-out', async () => {
    getServerSession.mockResolvedValue({
      role: null,
      eligibleRoles: [],
      userId: '',
      accountOutcome: 'no_invitation',
    });
    const html = await render();
    expect(html).toContain('role="status"');
    expect(html).toContain('set up an account for this email address');
    expect(html).toContain('data-signout');
    expect(html).not.toContain('data-chooser');
  });

  it('with an account but no matching role, says so', async () => {
    getServerSession.mockResolvedValue({
      role: null,
      eligibleRoles: [],
      userId: USER,
      accountOutcome: 'existing',
    });
    expect(await render()).toContain('no role at your school that matches');
  });
});

describe('RoleChoice', () => {
  it('renders one button per role, labelled for a person, in the order given', () => {
    const html = renderToStaticMarkup(
      createElement(RoleChoice, {
        roles: ['teacher', 'hod'],
        busy: false,
        onChoose: () => {},
      }),
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html.indexOf('Teacher')).toBeLessThan(html.indexOf('Head of Department'));
    expect(html).not.toContain('disabled=""');
  });

  it('disables every button while a choice is being saved', () => {
    const html = renderToStaticMarkup(
      createElement(RoleChoice, {
        roles: ['teacher', 'hod'],
        busy: true,
        onChoose: () => {},
      }),
    );
    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });

  it('says that changing role means signing in again', () => {
    const html = renderToStaticMarkup(
      createElement(RoleChoice, {
        roles: ['teacher', 'hod'],
        busy: false,
        onChoose: () => {},
      }),
    );
    expect(html).toContain('sign in again');
  });
});
