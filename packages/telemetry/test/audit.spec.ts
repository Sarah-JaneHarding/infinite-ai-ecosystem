// The audit ledger's hash chain — Stage 02 step 6, and the exit gate's "ledger hash chain
// verified by test".
//
// The chain exists to make tampering detectable by someone who has enough database access
// to defeat the append-only trigger. So these tests are written from the attacker's side:
// each one performs a specific alteration and asserts the chain reports it.

import { describe, expect, it } from 'vitest';

import {
  buildChain,
  canonicalise,
  chainEvent,
  hashEvent,
  verifyChain,
  type AuditEventInput,
} from '../src/audit.js';

const TENANT = '11111111-1111-4111-8111-111111111111';
const OTHER_TENANT = '22222222-2222-4222-8222-222222222222';

const event = (over: Partial<AuditEventInput> = {}): AuditEventInput => ({
  tenantId: TENANT,
  actorId: '33333333-3333-4333-8333-333333333333',
  action: 'read',
  resourceType: 'learner',
  resourceId: '44444444-4444-4444-8444-444444444444',
  purpose: 'screening',
  traceId: 'trace-1',
  diff: null,
  at: new Date('2026-07-01T09:00:00Z'),
  ...over,
});

const sequence = (count: number): AuditEventInput[] =>
  Array.from({ length: count }, (_, i) =>
    event({
      action: `action-${i}`,
      at: new Date(Date.parse('2026-07-01T09:00:00Z') + i * 60_000),
    }),
  );

describe('hashing', () => {
  it('is deterministic', () => {
    expect(hashEvent(event(), null)).toEqual(hashEvent(event(), null));
  });

  it('changes when any field changes', () => {
    const base = hashEvent(event(), null);
    expect(hashEvent(event({ action: 'update' }), null)).not.toEqual(base);
    expect(hashEvent(event({ purpose: 'planning' }), null)).not.toEqual(base);
    expect(hashEvent(event({ actorId: null }), null)).not.toEqual(base);
    expect(hashEvent(event({ at: new Date('2026-07-01T09:00:01Z') }), null)).not.toEqual(
      base,
    );
  });

  it('changes when the previous hash changes', () => {
    const other = hashEvent(event({ action: 'other' }), null);
    expect(hashEvent(event(), other)).not.toEqual(hashEvent(event(), null));
  });

  it('distinguishes null from empty string', () => {
    // Without a distinct null marker, an absent purpose could be forged as an empty one.
    expect(hashEvent(event({ purpose: null }), null)).not.toEqual(
      hashEvent(event({ purpose: '' }), null),
    );
  });

  it('is not vulnerable to a field-boundary shift', () => {
    // Without length prefixes, ("read", "xy") and ("readx", "y") would canonicalise to the
    // same bytes — a forgery anyone could find in five minutes.
    const a = canonicalise(event({ action: 'read', resourceType: 'xy' }), null);
    const b = canonicalise(event({ action: 'readx', resourceType: 'y' }), null);
    expect(a.equals(b)).toBe(false);
  });
});

describe('a well-formed chain', () => {
  it('verifies', () => {
    const result = verifyChain(buildChain(sequence(5)));
    expect(result.intact).toBe(true);
    if (result.intact) expect(result.length).toBe(5);
  });

  it('verifies when empty', () => {
    expect(verifyChain([]).intact).toBe(true);
  });

  it('verifies a single genesis event', () => {
    expect(verifyChain(buildChain(sequence(1))).intact).toBe(true);
  });
});

describe('tampering is detected', () => {
  it('catches a rewritten event', () => {
    const chain = buildChain(sequence(5));
    // The classic attack: change what an event says and leave its hash alone.
    const tampered = [...chain];
    tampered[2] = { ...tampered[2]!, action: 'covering-my-tracks' };

    const result = verifyChain(tampered);
    expect(result.intact).toBe(false);
    if (!result.intact) {
      expect(result.brokenAt).toBe(2);
      expect(result.problem).toBe('hash_mismatch');
    }
  });

  it('catches a rewritten event whose hash was recomputed', () => {
    // The more competent attack: rewrite the event *and* fix its hash. The chain still
    // breaks, because event 3 stores the old hash as its previousHash.
    const chain = buildChain(sequence(5));
    const rewritten = { ...chain[2]!, action: 'covering-my-tracks' };
    const tampered = [...chain];
    tampered[2] = { ...rewritten, hash: hashEvent(rewritten, rewritten.previousHash) };

    const result = verifyChain(tampered);
    expect(result.intact).toBe(false);
    if (!result.intact) {
      expect(result.brokenAt).toBe(3);
      expect(result.problem).toBe('broken_link');
    }
  });

  it('catches a deleted event', () => {
    const chain = buildChain(sequence(5));
    const withHole = [...chain.slice(0, 2), ...chain.slice(3)];
    const result = verifyChain(withHole);
    expect(result.intact).toBe(false);
    if (!result.intact) expect(result.problem).toBe('broken_link');
  });

  it('catches a truncated tail only if the head is also verified', () => {
    // Removing the most recent events leaves a valid shorter chain. This is the chain's
    // known limitation, and pretending otherwise would be worse than stating it: detecting
    // truncation needs an external anchor, which Stage 15 adds by recording the head hash
    // in the nightly snapshot.
    const chain = buildChain(sequence(5));
    expect(verifyChain(chain.slice(0, 3)).intact).toBe(true);
  });

  it('catches events reordered', () => {
    const chain = buildChain(sequence(5));
    const swapped = [...chain];
    [swapped[1], swapped[2]] = [swapped[2]!, swapped[1]!];
    expect(verifyChain(swapped).intact).toBe(false);
  });

  it('catches an event spliced in from another tenant', () => {
    const chain = buildChain(sequence(3));
    const foreign = chainEvent(event({ tenantId: OTHER_TENANT }), chain[1]!.hash);
    const spliced = [chain[0]!, chain[1]!, foreign];
    const result = verifyChain(spliced);
    expect(result.intact).toBe(false);
    if (!result.intact) expect(result.problem).toBe('tenant_mismatch');
  });

  it('catches a chain that does not start at genesis', () => {
    const chain = buildChain(sequence(3));
    const result = verifyChain(chain.slice(1));
    expect(result.intact).toBe(false);
    if (!result.intact) expect(result.problem).toBe('unexpected_genesis');
  });

  it('catches a second genesis inserted mid-chain', () => {
    const chain = buildChain(sequence(3));
    const orphan = chainEvent(event({ action: 'orphan' }), null);
    const result = verifyChain([chain[0]!, orphan, chain[1]!]);
    expect(result.intact).toBe(false);
    if (!result.intact) expect(result.problem).toBe('missing_genesis');
  });

  it('reports where the break is, not merely that there is one', () => {
    // "Tampered at event 4,182 on 3 March" is actionable; "tampered" is not.
    const chain = buildChain(sequence(10));
    const tampered = [...chain];
    tampered[7] = { ...tampered[7]!, purpose: 'product_improvement' };
    const result = verifyChain(tampered);
    expect(result.intact).toBe(false);
    if (!result.intact) expect(result.brokenAt).toBe(7);
  });
});

describe('chain construction', () => {
  it('gives the first event a null previousHash and the rest a real one', () => {
    const chain = buildChain(sequence(3));
    expect(chain[0]!.previousHash).toBeNull();
    expect(chain[1]!.previousHash).toEqual(chain[0]!.hash);
    expect(chain[2]!.previousHash).toEqual(chain[1]!.hash);
  });

  it('produces 32-byte SHA-256 hashes', () => {
    expect(buildChain(sequence(1))[0]!.hash.length).toBe(32);
  });

  it('handles a diff payload without breaking determinism', () => {
    const withDiff = event({ diff: { before: { grade: '5' }, after: { grade: '6' } } });
    expect(hashEvent(withDiff, null)).toEqual(hashEvent(withDiff, null));
    expect(hashEvent(withDiff, null)).not.toEqual(hashEvent(event({ diff: null }), null));
  });

  it("hashes the same regardless of a diff object's own key order", () => {
    // Postgres's jsonb column type (packages/db's `audit_event.diff`) does not preserve
    // the key order it is given — it reorders keys internally. An event's hash must not
    // depend on that order, or the same content would hash differently before and after a
    // round trip through storage, which looked exactly like tampering the first time a
    // real caller hit it (see docs/STAGE_LOG.md's Stage 05 step 7 write-up).
    const inOneOrder = event({
      diff: {
        toStatus: 'RETENTION_SCHEDULED',
        retentionCategory: null,
        retentionRuleId: null,
      },
    });
    const inAnotherOrder = event({
      diff: {
        retentionRuleId: null,
        toStatus: 'RETENTION_SCHEDULED',
        retentionCategory: null,
      },
    });
    expect(hashEvent(inOneOrder, null)).toEqual(hashEvent(inAnotherOrder, null));
  });

  it('still distinguishes genuinely different diff content', () => {
    const a = event({ diff: { toStatus: 'COMMITTED' } });
    const b = event({ diff: { toStatus: 'INDEXED' } });
    expect(hashEvent(a, null)).not.toEqual(hashEvent(b, null));
  });

  it('sorts diff keys recursively, not only at the top level', () => {
    const nested = event({ diff: { outer: { z: 1, a: 2 } } });
    const nestedReordered = event({ diff: { outer: { a: 2, z: 1 } } });
    expect(hashEvent(nested, null)).toEqual(hashEvent(nestedReordered, null));
  });
});
