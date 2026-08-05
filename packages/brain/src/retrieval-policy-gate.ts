// The policy + RBAC + purpose gate — Stage 05 step 4, second stage.
//
// "The policy gate runs before retrieval, never after." `retrieval-path.ts`'s orchestrator
// is what actually enforces the ordering (this function does no I/O and could be called
// at any point); the ordering guarantee is that nothing else in the pipeline runs unless
// this stage returns `allowed: true` first.
//
// No composed "RBAC + purpose + consent" gate existed anywhere in the repo before this —
// `authorize()` (rbac.ts) and `resolveAccess()` (access.ts, which already sequences
// tombstone → purpose → consent internally) are two separate, pure entry points with no
// shared caller. This composes them the only way that keeps the manual's own ordering:
// coarse role/scope first (can this actor read this *kind* of thing at all, in this
// scope?), then, only for a retrieval about one named data subject, the fine-grained
// purpose/consent projection over the categories requested.
//
// A retrieval with no single subject (curriculum canon, a topic, a CAPS code) has nothing
// for `resolveAccess` to project — RBAC alone is the whole gate for those.

import {
  authorize,
  resolveAccess,
  type Actor,
  type AccessDecision,
  type Decision,
  type Resource,
} from '@infinite-ai/policy';
import type { Purpose } from '@infinite-ai/contracts';

import type { RetrievalSubject } from './retrieval-types.js';

export type RetrievalPolicyDecision =
  | { readonly allowed: false; readonly reason: 'rbac_denied'; readonly rbac: Decision }
  | {
      readonly allowed: true;
      readonly rbac: Decision;
      readonly access: AccessDecision | null;
    };

export function gateRetrieval(
  actor: Actor,
  resource: Resource,
  purpose: Purpose,
  subject: RetrievalSubject | null,
  now: Date,
): RetrievalPolicyDecision {
  const rbac = authorize(actor, 'read', resource, now);
  if (!rbac.allowed) {
    return { allowed: false, reason: 'rbac_denied', rbac };
  }
  if (subject === null) {
    return { allowed: true, rbac, access: null };
  }
  const access = resolveAccess({
    purpose,
    subjectToken: subject.subjectToken,
    requested: subject.requestedCategories,
    ledger: subject.ledger,
    tombstonedAt: subject.tombstonedAt,
    at: now,
  });
  return { allowed: true, rbac, access };
}
