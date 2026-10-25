import { describe, expect, it } from 'vitest';

import {
  addRelease,
  bumpPatch,
  cmpVersion,
  prepareRollback,
  wire,
  type History,
  type WidgetRelease,
} from '../src/index.js';

const jane = { accountId: null, name: 'Jane Dlamini', role: 'Head of Department' };
const base = (
  v: string,
  parent: string | null,
  extra: Partial<WidgetRelease> = {},
): WidgetRelease => ({
  widgetId: 'PD-W01',
  version: v,
  parentVersion: parent,
  changeKind: parent ? 'edit' : 'initial',
  reason: parent ? 'tidy wording' : 'first release',
  rollbackOf: null,
  createdAt: '2026-10-25T10:00:00.000Z',
  contentHash: `sha256:${v}`,
  ratification: {
    actor: jane,
    at: '2026-10-25T10:01:00.000Z',
    contentHash: `sha256:${v}`,
  },
  agentId: 'PD-01',
  ...extra,
});
const empty: History = { widgetId: 'PD-W01', releases: [], wired: null };
const must = <T>(r: { ok: boolean; value?: T }): T => {
  if (!r.ok) throw new Error('expected ok');
  return r.value as T;
};

describe('versions', () => {
  it('compares numerically', () => {
    expect(cmpVersion('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(bumpPatch('1.2.9')).toBe('1.2.10');
  });
});

describe('addRelease', () => {
  it('accepts a ratified release', () => {
    expect(addRelease(empty, base('0.1.0', null)).ok).toBe(true);
  });
  it('refuses an unratified release', () => {
    const r = addRelease(empty, base('0.1.0', null, { ratification: null }));
    expect(r).toEqual({ ok: false, error: { code: 'NOT_RATIFIED' } });
  });
  it('refuses a ratification of different content', () => {
    const r = base('0.1.0', null);
    r.ratification = { ...r.ratification!, contentHash: 'sha256:other' };
    expect(addRelease(empty, r)).toEqual({ ok: false, error: { code: 'HASH_MISMATCH' } });
  });
  it('requires a reason after the first release', () => {
    const h = must(addRelease(empty, base('0.1.0', null)));
    expect(addRelease(h, base('0.1.1', '0.1.0', { reason: '  ' }))).toEqual({
      ok: false,
      error: { code: 'REASON_REQUIRED' },
    });
  });
  it('refuses a code or a single word as the ratifier', () => {
    for (const name of ['T04', 'Jane', '8001015009087']) {
      const r = base('0.1.0', null);
      r.ratification = { ...r.ratification!, actor: { ...jane, name } };
      const out = addRelease(empty, r);
      expect(out.ok).toBe(false);
    }
  });
  it('refuses a version that is not newer', () => {
    const h = must(addRelease(empty, base('0.1.1', null)));
    expect(addRelease(h, base('0.1.0', null))).toEqual({
      ok: false,
      error: { code: 'VERSION_NOT_NEWER', current: '0.1.1' },
    });
  });
});

describe('rollback is a new forward release', () => {
  const h = must(
    addRelease(must(addRelease(empty, base('0.1.0', null))), base('0.1.1', '0.1.0')),
  );
  it('needs a reason and a named person', () => {
    expect(prepareRollback(h, '0.1.0', '', jane, 'x')).toEqual({
      ok: false,
      error: { code: 'REASON_REQUIRED' },
    });
    expect(
      prepareRollback(h, '0.1.0', 'bad edit', { ...jane, name: 'T04' }, 'x').ok,
    ).toBe(false);
  });
  it('restores the old content as the next version and still needs ratifying', () => {
    const r = must(
      prepareRollback(h, '0.1.0', 'bad edit', jane, '2026-10-25T11:00:00.000Z'),
    );
    expect(r.version).toBe('0.1.2');
    expect(r.contentHash).toBe('sha256:0.1.0');
    expect(r.rollbackOf).toBe('0.1.0');
    expect(r.ratification).toBeNull();
    expect(addRelease(h, r)).toEqual({ ok: false, error: { code: 'NOT_RATIFIED' } });
  });
  it('rejects an unknown target', () => {
    expect(prepareRollback(h, '9.9.9', 'x', jane, 'x')).toEqual({
      ok: false,
      error: { code: 'UNKNOWN_VERSION', version: '9.9.9' },
    });
  });
});

describe('wire', () => {
  it('wires only a ratified known version', () => {
    const h = must(addRelease(empty, base('0.1.0', null)));
    expect(must(wire(h, '0.1.0', jane)).wired).toBe('0.1.0');
    expect(wire(h, '0.2.0', jane).ok).toBe(false);
  });
});
