import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PLATFORM_ROLES, Role } from '../src/rbac.js';

// OQ-036 drift guard. docs/SECURITY.md §7 says MFA is required for `admin`, `smt`, `sbst_chair` and the
// platform roles, and that email is verified. That is only true if the committed Keycloak
// realm says so. This reads infra/keycloak/realm.json and fails when the browser flow, a role
// condition or a required action is missing, so the claim cannot go stale unnoticed.
//
// What this proves: the realm configuration. What it does NOT prove: that Keycloak accepts
// the import and prompts for the code. That is checked once against a running Keycloak
// (docs/OPEN_QUESTIONS.md, OQ-036) and again whenever the Keycloak version changes.

interface Execution {
  readonly authenticator?: string;
  readonly authenticatorConfig?: string;
  readonly authenticatorFlow?: boolean;
  readonly requirement: string;
  readonly flowAlias?: string;
  readonly userSetupAllowed?: boolean;
}
interface Flow {
  readonly alias: string;
  readonly topLevel: boolean;
  readonly authenticationExecutions: readonly Execution[];
}
interface Realm {
  readonly verifyEmail?: boolean;
  readonly browserFlow?: string;
  readonly authenticationFlows?: readonly Flow[];
  readonly authenticatorConfig?: readonly {
    readonly alias: string;
    readonly config: Record<string, string>;
  }[];
  readonly requiredActions?: readonly {
    readonly alias: string;
    readonly enabled: boolean;
  }[];
  readonly roles: { readonly realm: readonly { readonly name: string }[] };
  readonly users: readonly {
    readonly username: string;
    readonly emailVerified?: boolean;
    readonly serviceAccountClientId?: string;
  }[];
}

const realm = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', '..', 'infra', 'keycloak', 'realm.json'),
    'utf8',
  ),
) as Realm;

// `sbst_chair` was added on 2026-11-12 (OQ-046 follow-up, owner decision): the chair's confirmation ratifies
// SBST minutes into the Brain as a versioned fact, so confirming them needs a second factor.
const MFA_ROLES = ['admin', 'smt', 'sbst_chair', ...PLATFORM_ROLES] as const;
const flows = realm.authenticationFlows ?? [];
const flowByAlias = (alias: string): Flow | undefined =>
  flows.find((f) => f.alias === alias);

describe('Keycloak realm: email verification and MFA (OQ-036)', () => {
  it('requires email verification, with the required action enabled', () => {
    expect(realm.verifyEmail).toBe(true);
    expect(realm.requiredActions?.find((a) => a.alias === 'VERIFY_EMAIL')?.enabled).toBe(
      true,
    );
  });

  it('enables the CONFIGURE_TOTP required action so a user can enrol', () => {
    expect(
      realm.requiredActions?.find((a) => a.alias === 'CONFIGURE_TOTP')?.enabled,
    ).toBe(true);
  });

  it('uses a custom top-level browser flow that exists', () => {
    expect(realm.browserFlow).toBeDefined();
    expect(realm.browserFlow).not.toBe('browser');
    const top = flowByAlias(realm.browserFlow ?? '');
    expect(top?.topLevel).toBe(true);
  });

  it('every sub-flow and config an execution points at exists', () => {
    const configs = new Set((realm.authenticatorConfig ?? []).map((c) => c.alias));
    for (const flow of flows) {
      for (const e of flow.authenticationExecutions) {
        if (e.authenticatorFlow === true) {
          expect(
            flowByAlias(e.flowAlias ?? ''),
            `${flow.alias} -> ${e.flowAlias}`,
          ).toBeDefined();
        }
        if (e.authenticatorConfig !== undefined) {
          expect(
            configs.has(e.authenticatorConfig),
            `${flow.alias} -> ${e.authenticatorConfig}`,
          ).toBe(true);
        }
      }
    }
  });

  it('requires the second factor from the SBST chair, whose confirmation ratifies minutes into the Brain', () => {
    expect(MFA_ROLES).toContain('sbst_chair');
    const forms = flowByAlias('browser-mfa forms');
    const names = (forms?.authenticationExecutions ?? []).map((e) => e.flowAlias);
    expect(names).toContain('browser-mfa otp sbst_chair');
  });

  it('does not ask for a code from roles that have no sub-flow: the second factor is exactly the listed roles', () => {
    const guarded = flows
      .filter((f) => f.alias.startsWith('browser-mfa otp '))
      .map((f) => f.alias.replace('browser-mfa otp ', ''))
      .sort();
    expect(guarded).toEqual([...MFA_ROLES].sort());
  });

  it.each(MFA_ROLES.map((r) => [r] as const))(
    'a user holding %s must pass an OTP step that sets itself up on first login',
    (role) => {
      const conditional = flows.find((f) => {
        const cond = f.authenticationExecutions.find(
          (e) => e.authenticator === 'conditional-user-role',
        );
        const cfg = realm.authenticatorConfig?.find(
          (c) => c.alias === cond?.authenticatorConfig,
        );
        return cfg?.config.condUserRole === role && cfg.config.negate === 'false';
      });
      expect(conditional, `no conditional OTP sub-flow for ${role}`).toBeDefined();
      const reqs = (conditional?.authenticationExecutions ?? []).map((e) => [
        e.authenticator,
        e.requirement,
      ]);
      expect(reqs).toContainEqual(['conditional-user-role', 'REQUIRED']);
      expect(reqs).toContainEqual(['auth-otp-form', 'REQUIRED']);
      const otp = conditional?.authenticationExecutions.find(
        (e) => e.authenticator === 'auth-otp-form',
      );
      expect(otp?.userSetupAllowed).toBe(true);
      // ...and the conditional sub-flow is actually reached from the browser flow's forms step.
      const reached = flows.some((f) =>
        f.authenticationExecutions.some(
          (e) => e.flowAlias === conditional?.alias && e.requirement === 'CONDITIONAL',
        ),
      );
      expect(reached, `${role} OTP sub-flow is never invoked`).toBe(true);
    },
  );

  it('the browser flow still asks for a password before any OTP step', () => {
    const forms = flows.find((f) =>
      f.authenticationExecutions.some(
        (e) => e.authenticator === 'auth-username-password-form',
      ),
    );
    expect(forms?.authenticationExecutions[0]?.authenticator).toBe(
      'auth-username-password-form',
    );
    expect(forms?.authenticationExecutions[0]?.requirement).toBe('REQUIRED');
  });

  it('keys MFA on roles that exist in the realm, and names no role that does not', () => {
    const realmRoles = realm.roles.realm.map((r) => r.name);
    for (const role of MFA_ROLES) expect(realmRoles).toContain(role);
    for (const role of MFA_ROLES) expect(Role.safeParse(role).success).toBe(true);
  });

  it('every seeded dev user is email-verified (dev has no mail server)', () => {
    // A service account signs in with a client secret, has no mailbox and no browser flow.
    for (const u of realm.users.filter((u) => u.serviceAccountClientId === undefined)) {
      expect(u.emailVerified, u.username).toBe(true);
    }
  });
});
