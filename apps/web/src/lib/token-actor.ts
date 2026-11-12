// The caller's tenant and actor, read from the verified session token in an API route.
//
// OQ-033: the actor is the account id resolved at sign-in (`token.userId`), never the OIDC
// `sub`. Reading `sub` here is what made every gate decision fail: the role check looks the
// actor up in `role_assignment`, which references `user_account.id`.

import type { Role } from '@infinite-ai/policy';

import { readRole } from './session-role';

/**
 * The role the session is acting as, or `null` when it has none (it has yet to choose one, OQ-032).
 * A gate decision is made *as* this role (`decideHumanGate`'s `actingAs`); `null` decides nothing.
 */
export function readTokenActingAs(token: unknown): Role | null {
  if (typeof token !== 'object' || token === null) return null;
  return readRole((token as Record<string, unknown>)['role']);
}

export interface TokenActor {
  readonly tenantId: string;
  readonly actorId: string;
}

export type TokenActorResult =
  | { readonly ok: true; readonly actor: TokenActor }
  | { readonly ok: false; readonly status: 401 | 403; readonly error: string };

/** `token` is the result of `getToken()`: `null` when there is no valid session. */
export function readTokenActor(token: unknown): TokenActorResult {
  if (typeof token !== 'object' || token === null) {
    return { ok: false, status: 401, error: 'Unauthenticated' };
  }
  const fields = token as Record<string, unknown>;
  const tenantId = typeof fields['tenantId'] === 'string' ? fields['tenantId'] : '';
  if (tenantId === '') {
    return { ok: false, status: 403, error: 'No tenant context' };
  }
  const actorId = typeof fields['userId'] === 'string' ? fields['userId'] : '';
  if (actorId === '') {
    // Signed in, but this person has no active account at this school (or the session
    // predates account resolution). Acting needs an account; sign in again once one exists.
    return { ok: false, status: 403, error: 'No active account for this user' };
  }
  return { ok: true, actor: { tenantId, actorId } };
}
