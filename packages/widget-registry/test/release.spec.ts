import { describe, expect, it } from 'vitest';

import {
  addRelease,
  bumpPatch,
  cmpVersion,
  mayOfferToOtherSchools,
  prepareRollback,
  submitStatus,
  wire,
  type History,
  type WidgetRelease,
} from '../src/index.js';

const jane = {
  accountId: '11111111-1111-4111-8111-111111111111',
  name: 'Jane Dlamini',
  role: 'Head of Department',
};
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

describe('the signed-in account is the actor of record (OQ-038)', () => {
  it('refuses a ratification with a typed name and no account', () => {
    const r = base('0.1.0', null);
    r.ratification = { ...r.ratification!, actor: { ...jane, accountId: null } };
    expect(addRelease(empty, r)).toEqual({
      ok: false,
      error: { code: 'ACCOUNT_REQUIRED' },
    });
  });
  it('refuses to wire or roll back without an account', () => {
    const h = must(addRelease(empty, base('0.1.0', null)));
    expect(wire(h, '0.1.0', { ...jane, accountId: null })).toEqual({
      ok: false,
      error: { code: 'ACCOUNT_REQUIRED' },
    });
    expect(prepareRollback(h, '0.1.0', 'why', { ...jane, accountId: null }, 'x')).toEqual(
      { ok: false, error: { code: 'ACCOUNT_REQUIRED' } },
    );
  });
});

describe('public offers (OQ-037, OQ-039)', () => {
  it('shows a widget to other schools only when cleaned and platform-approved', () => {
    expect(
      mayOfferToOtherSchools({
        visibility: 'private',
        schoolInfoRemoved: true,
        platformApproved: true,
      }).ok,
    ).toBe(false);
    expect(
      mayOfferToOtherSchools({
        visibility: 'public',
        schoolInfoRemoved: false,
        platformApproved: true,
      }),
    ).toEqual({ ok: false, code: 'SCHOOL_INFO_NOT_REMOVED' });
    expect(
      mayOfferToOtherSchools({
        visibility: 'public',
        schoolInfoRemoved: true,
        platformApproved: false,
      }),
    ).toEqual({ ok: false, code: 'PUBLIC_NEEDS_PLATFORM_REVIEW' });
    expect(
      mayOfferToOtherSchools({
        visibility: 'public',
        schoolInfoRemoved: true,
        platformApproved: true,
      }),
    ).toEqual({ ok: true });
  });
  it('submits a public widget for review, never live', () => {
    expect(submitStatus('public')).toBe('submitted_for_platform_review');
    expect(submitStatus('private')).toBe('ratified_private');
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
