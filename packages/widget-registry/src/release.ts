// Release history rules: ratify, wire, roll back. Roll back is a new forward version
// that restores earlier content; history is never rewritten.

import type { Actor, RegistryError, Result, WidgetRelease } from './types.js';

export interface History {
  readonly widgetId: string;
  /** Oldest first. */
  readonly releases: readonly WidgetRelease[];
  /** Version currently wired into a school's ecosystem, or null. */
  readonly wired: string | null;
}

const fail = <T>(error: RegistryError): Result<T> => ({ ok: false, error });

export function cmpVersion(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function bumpPatch(v: string): string {
  const p = v.split('.').map(Number);
  return `${p[0] ?? 0}.${p[1] ?? 0}.${(p[2] ?? 0) + 1}`;
}

/** Names and codes are not people: a typed name must look like a first name and surname. */
export function actorProblem(a: Actor): string | null {
  const n = a.name.trim();
  if (!/\s/.test(n)) return 'first name and surname are needed';
  if (/^[A-Za-z]{1,2}\d+$/.test(n) || /\d{6,}/.test(n))
    return 'a name is needed, not a code or number';
  return null;
}

export function latest(h: History): WidgetRelease | undefined {
  return [...h.releases].sort((a, b) => cmpVersion(b.version, a.version))[0];
}

/** Add a ratified release. The ratifier must be named and the reason given. */
export function addRelease(h: History, r: WidgetRelease): Result<History> {
  if (r.version === r.parentVersion) return fail({ code: 'SELF_PARENT' });
  if (r.changeKind !== 'initial' && !r.reason.trim())
    return fail({ code: 'REASON_REQUIRED' });
  if (!r.ratification) return fail({ code: 'NOT_RATIFIED' });
  if (r.ratification.contentHash !== r.contentHash)
    return fail({ code: 'HASH_MISMATCH' });
  if (!r.ratification.actor.accountId) return fail({ code: 'ACCOUNT_REQUIRED' });
  const problem = actorProblem(r.ratification.actor);
  if (problem) return fail({ code: 'ACTOR_REQUIRED', detail: problem });
  const cur = latest(h);
  if (cur && cmpVersion(r.version, cur.version) <= 0)
    return fail({ code: 'VERSION_NOT_NEWER', current: cur.version });
  return { ok: true, value: { ...h, releases: [...h.releases, r] } };
}

/**
 * Prepare a roll back: a new release that carries the content hash of an earlier one.
 * It still needs a ratification before it can be added.
 */
export function prepareRollback(
  h: History,
  target: string,
  reason: string,
  by: Actor,
  now: string,
): Result<WidgetRelease> {
  if (!reason.trim()) return fail({ code: 'REASON_REQUIRED' });
  if (!by.accountId) return fail({ code: 'ACCOUNT_REQUIRED' });
  const problem = actorProblem(by);
  if (problem) return fail({ code: 'ACTOR_REQUIRED', detail: problem });
  const old = h.releases.find((x) => x.version === target);
  const cur = latest(h);
  if (!old || !cur) return fail({ code: 'UNKNOWN_VERSION', version: target });
  return {
    ok: true,
    value: {
      widgetId: h.widgetId,
      version: bumpPatch(cur.version),
      parentVersion: cur.version,
      changeKind: 'rollback',
      reason,
      rollbackOf: target,
      createdAt: now,
      contentHash: old.contentHash,
      ratification: null,
      agentId: old.agentId,
    },
  };
}

/** Wire a ratified release. Only a ratified, known version can be wired. */
export function wire(h: History, version: string, by: Actor): Result<History> {
  if (!by.accountId) return fail({ code: 'ACCOUNT_REQUIRED' });
  const r = h.releases.find((x) => x.version === version);
  if (!r) return fail({ code: 'UNKNOWN_VERSION', version });
  if (!r.ratification) return fail({ code: 'NOT_RATIFIED' });
  const problem = actorProblem(by);
  if (problem) return fail({ code: 'ACTOR_REQUIRED', detail: problem });
  return { ok: true, value: { ...h, wired: version } };
}
