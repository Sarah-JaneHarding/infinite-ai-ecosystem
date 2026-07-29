// The append-only, hash-chained audit ledger — Stage 02 steps 5 and 6.
//
// Stage 01 made the ledger append-only at the database level with a trigger. That stops
// the application rewriting history. It does not stop someone with DDL rights dropping the
// trigger and then rewriting it — and the people most likely to have DDL rights are the
// people an audit trail exists to hold accountable.
//
// The hash chain closes that. Each event stores the hash of the previous event for its
// tenant, so altering or removing any event breaks every hash after it. Tampering becomes
// detectable rather than merely forbidden, which is the difference between a control and
// a hope.
//
// Pure functions over an explicit previous-hash, so the chain can be verified without a
// database and the tamper-detection job is a fold rather than a query loop.

import { createHash } from 'node:crypto';

/** What happened, in the form the ledger stores it. */
export interface AuditEventInput {
  readonly tenantId: string;
  readonly actorId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  /** The declared purpose this access was made under (Stage 03 taxonomy). */
  readonly purpose: string | null;
  /** One trace id from user action to database write. */
  readonly traceId: string | null;
  /** JSON diff for writes. Never contains plaintext personal information. */
  readonly diff: unknown;
  readonly at: Date;
}

export interface ChainedAuditEvent extends AuditEventInput {
  /** Hash of the previous event for this tenant. Null only for the first. */
  readonly previousHash: Buffer | null;
  readonly hash: Buffer;
}

/**
 * The canonical byte form of an event.
 *
 * Field order is fixed and every field is length-prefixed. Both matter: a chain built over
 * `JSON.stringify` would be vulnerable to key reordering producing a different hash for
 * the same event, and a chain built over concatenation without lengths would let
 * `{action: "read", resource: "xy"}` and `{action: "readx", resource: "y"}` collide.
 * Neither is exotic — the second is a five-minute forgery once someone notices.
 */
export function canonicalise(
  event: AuditEventInput,
  previousHash: Buffer | null,
): Buffer {
  const parts: (string | null)[] = [
    event.tenantId,
    event.actorId,
    event.action,
    event.resourceType,
    event.resourceId,
    event.purpose,
    event.traceId,
    event.diff === undefined ? null : JSON.stringify(event.diff ?? null),
    event.at.toISOString(),
  ];

  const chunks: Buffer[] = [];
  for (const part of parts) {
    if (part === null) {
      // A distinct marker for null, so an absent field cannot be forged as an empty one.
      chunks.push(Buffer.from([0x00]));
      continue;
    }
    const encoded = Buffer.from(part, 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(encoded.length);
    chunks.push(Buffer.from([0x01]), length, encoded);
  }

  chunks.push(previousHash ?? Buffer.from([0x00]));
  return Buffer.concat(chunks);
}

/** Computes the hash that seals an event to its predecessor. */
export function hashEvent(event: AuditEventInput, previousHash: Buffer | null): Buffer {
  return createHash('sha256').update(canonicalise(event, previousHash)).digest();
}

/** Links an event onto the end of a tenant's chain. */
export function chainEvent(
  event: AuditEventInput,
  previousHash: Buffer | null,
): ChainedAuditEvent {
  return { ...event, previousHash, hash: hashEvent(event, previousHash) };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type ChainVerification =
  | { readonly intact: true; readonly length: number }
  | {
      readonly intact: false;
      /** Index of the first event that does not verify. */
      readonly brokenAt: number;
      readonly problem: ChainProblem;
    };

export type ChainProblem =
  | 'hash_mismatch'
  | 'broken_link'
  | 'unexpected_genesis'
  | 'missing_genesis'
  | 'out_of_order'
  | 'tenant_mismatch';

/**
 * Walks a tenant's chain and reports the first break.
 *
 * Returns the index rather than a boolean because "the ledger was tampered with" and "the
 * ledger was tampered with at event 4,182 on 3 March" are very different messages to hand
 * an incident responder.
 *
 * Detects four distinct failures, because they mean different things:
 *  - a rewritten event         → hash_mismatch
 *  - a deleted event           → broken_link
 *  - events reordered          → out_of_order
 *  - a chain spliced from      → tenant_mismatch
 *    another tenant's events
 */
export function verifyChain(events: readonly ChainedAuditEvent[]): ChainVerification {
  if (events.length === 0) return { intact: true, length: 0 };

  const tenantId = events[0]!.tenantId;
  let previous: Buffer | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;

    if (event.tenantId !== tenantId) {
      return { intact: false, brokenAt: index, problem: 'tenant_mismatch' };
    }

    if (index === 0) {
      if (event.previousHash !== null) {
        return { intact: false, brokenAt: 0, problem: 'unexpected_genesis' };
      }
    } else {
      if (event.previousHash === null) {
        return { intact: false, brokenAt: index, problem: 'missing_genesis' };
      }
      if (!event.previousHash.equals(previous!)) {
        return { intact: false, brokenAt: index, problem: 'broken_link' };
      }
      if (event.at.getTime() < events[index - 1]!.at.getTime()) {
        return { intact: false, brokenAt: index, problem: 'out_of_order' };
      }
    }

    if (!hashEvent(event, event.previousHash).equals(event.hash)) {
      return { intact: false, brokenAt: index, problem: 'hash_mismatch' };
    }

    previous = event.hash;
  }

  return { intact: true, length: events.length };
}

/**
 * Builds a chain from scratch. Used by the seed path and by tests.
 *
 * Not used on the write path: production appends one event at a time against the stored
 * head, because rebuilding a chain to add to it would mean reading the whole ledger.
 */
export function buildChain(events: readonly AuditEventInput[]): ChainedAuditEvent[] {
  const chained: ChainedAuditEvent[] = [];
  let previous: Buffer | null = null;
  for (const event of events) {
    const linked = chainEvent(event, previous);
    chained.push(linked);
    previous = linked.hash;
  }
  return chained;
}
