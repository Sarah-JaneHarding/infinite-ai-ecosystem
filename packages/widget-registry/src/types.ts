// @infinite-ai/widget-registry — types.
//
// A widget release is a ratified, hashed package a school or the platform can wire.
// Nothing here performs I/O: persistence, notification and the cross-school catalogue
// are decided in docs/WIDGET_REGISTRY_DESIGN.md and gated on OQ-037 to OQ-039.

import { z } from 'zod';

const Semver = z.string().regex(/^\d+\.\d+\.\d+$/, 'version must be MAJOR.MINOR.PATCH');

export const ChangeKind = z.enum(['initial', 'edit', 'rollback', 'feature']);
export type ChangeKind = z.infer<typeof ChangeKind>;

/** A person who ratified or changed something. `accountId` is the platform user (OQ-038). */
export const Actor = z.object({
  /** user_account.id once identity is wired; null while only a typed name exists (the browser kit). */
  accountId: z.string().uuid().nullable(),
  /** Display name typed or resolved. Staff only, never a learner. */
  name: z.string().min(3),
  role: z.string().min(2),
});
export type Actor = z.infer<typeof Actor>;

export const Ratification = z.object({
  actor: Actor,
  at: z.string().datetime(),
  /** Hash of the exact release content that was ratified. */
  contentHash: z.string().min(8),
});
export type Ratification = z.infer<typeof Ratification>;

export const WidgetRelease = z.object({
  widgetId: z.string().min(1),
  version: Semver,
  parentVersion: Semver.nullable(),
  changeKind: ChangeKind,
  /** Why. Required for every change after the first release. */
  reason: z.string().min(1),
  /** Set when changeKind is "rollback": the version whose content is restored. */
  rollbackOf: Semver.nullable(),
  createdAt: z.string().datetime(),
  contentHash: z.string().min(8),
  ratification: Ratification.nullable(),
  /** Agent the output is laid out for; null for a platform function or a new widget. */
  agentId: z.string().nullable(),
});
export type WidgetRelease = z.infer<typeof WidgetRelease>;

export type RegistryError =
  | { code: 'REASON_REQUIRED' }
  | { code: 'ACTOR_REQUIRED'; detail: string }
  | { code: 'NOT_RATIFIED' }
  | { code: 'SELF_PARENT' }
  | { code: 'VERSION_NOT_NEWER'; current: string }
  | { code: 'UNKNOWN_VERSION'; version: string }
  | { code: 'HASH_MISMATCH' }
  | { code: 'ROLE_NOT_ALLOWED'; role: string };

export type Result<T> = { ok: true; value: T } | { ok: false; error: RegistryError };
