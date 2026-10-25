// A minimal stand-in for the policy package's provisioning rules, used only by the db
// integration tests. The db package may not import policy (it is a higher layer), so the tests
// supply rules of the same shape; apps/web asserts at compile time that the real ones fit the
// interface. What matters to the data-layer tests is the rules' dependence on the administrator
// list handed in — which is exactly what the lock keeps honest.

import type { ProvisioningRules } from '../../src/provisioning.js';

const SENSITIVE = new Set(['admin', 'smt']);

export const testRules: ProvisioningRules = {
  conferral(input) {
    const admins = input.admins.activeAdminAccountIds;
    if (!admins.includes(input.actorAccountId))
      return { allowed: false, reason: 'actor_not_admin' };
    if (input.roles.length === 0) return { allowed: false, reason: 'no_roles' };
    if (
      input.target.kind === 'account' &&
      input.target.accountId === input.actorAccountId
    ) {
      return { allowed: false, reason: 'cannot_change_own_roles' };
    }
    if (!input.roles.some((r) => SENSITIVE.has(r))) {
      return { allowed: true, confirmation: 'not_required', confirmedBy: null };
    }
    if (admins.length < 2) {
      return { allowed: true, confirmation: 'waived_sole_admin', confirmedBy: null };
    }
    const confirmer = input.confirmedByAccountId ?? null;
    if (confirmer === null) return { allowed: false, reason: 'confirmation_required' };
    if (confirmer === input.actorAccountId)
      return { allowed: false, reason: 'confirmer_is_actor' };
    if (!admins.includes(confirmer))
      return { allowed: false, reason: 'confirmer_not_admin' };
    return { allowed: true, confirmation: 'confirmed', confirmedBy: confirmer };
  },
  revocation(input) {
    if (!input.admins.activeAdminAccountIds.includes(input.actorAccountId)) {
      return { allowed: false, reason: 'actor_not_admin' };
    }
    if (input.targetAccountId === input.actorAccountId) {
      return { allowed: false, reason: 'cannot_change_own_roles' };
    }
    return { allowed: true, confirmation: 'not_required', confirmedBy: null };
  },
  statusChange(input) {
    if (!input.admins.activeAdminAccountIds.includes(input.actorAccountId)) {
      return { allowed: false, reason: 'actor_not_admin' };
    }
    if (input.targetAccountId === input.actorAccountId) {
      return { allowed: false, reason: 'cannot_change_own_status' };
    }
    return { allowed: true, confirmation: 'not_required', confirmedBy: null };
  },
};
