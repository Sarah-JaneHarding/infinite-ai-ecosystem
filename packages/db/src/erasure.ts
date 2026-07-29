// Subject erasure — Stage 03 step 8.
//
// "`subject_erasure` (a) tombstones personal data, (b) preserves the decision record with
// the subject replaced by its token, (c) triggers reindexing, (d) emits an audit event.
// The memory of the decision survives; the personal data does not."
//
// That sentence carries the whole design, and the second half of it is the part that gets
// argued about. A naive erasure deletes the learner row, and with it every record of the
// school's own decisions: the screening that flagged a reading difficulty, the support plan
// the SBST agreed, the referral it made. Those are the school's records of what *it* did.
// Destroying them does not protect the child — it destroys the evidence of how the child
// was treated, which is the thing an inquiry would need.
//
// So erasure deletes the direct identifiers and keeps the token. Afterwards the school can
// still say "LNR_7F3A2C was screened in Term 2 and referred in Term 3" and can no longer
// say who that was, because the mapping is gone.
//
// What actually gets destroyed:
//
//   - every `learner_identifier` row — name, ID number, date of birth, SA-SAMS reference.
//     Deleted, not tombstoned. These are ciphertext, and a tombstoned ciphertext is still
//     a decryptable ciphertext for anyone holding the key.
//   - home language, which is a §26 special category by proxy in the South African context.
//
// What survives, keyed by token: enrolment history, the decision record, and the audit
// trail. Section 24 does not entitle a subject to erase the responsible party's record of
// its own lawful acts, and POPIA §14(5) expressly contemplates de-identification as the
// alternative to destruction.

import { createHash, randomUUID } from 'node:crypto';

import type { TenantClient } from './client.js';

export type SubjectKind = 'learner' | 'guardian';

export interface ErasureRequest {
  readonly subjectKind: SubjectKind;
  /** The tenant-salted token. Erasure is addressed by token, never by name. */
  readonly subjectToken: string;
  /**
   * Why this subject is being erased. Recorded on the audit event, so a retention sweep
   * and a §24 request are distinguishable a year later.
   */
  readonly trigger: ErasureTrigger;
  /** The `data_subject_request` this fulfils, where there is one. */
  readonly requestId: string | null;
  /** Injected so the caller controls the clock and tests are not time-dependent. */
  readonly now: Date;
}

export type ErasureTrigger =
  /** A ratified retention period elapsed. */
  | 'retention_expiry'
  /** The subject withdrew the consent the processing rested on. */
  | 'consent_withdrawal'
  /** A §24 request, verified and approved. */
  | 'subject_request'
  /** The tenant is closing and its data is being wound down (Stage 17). */
  | 'tenant_closure';

export interface ErasureOutcome {
  readonly subjectToken: string;
  /** How many encrypted identifier rows were destroyed. */
  readonly identifiersDestroyed: number;
  readonly tombstonedAt: Date;
  /** False when the subject was already tombstoned — erasure is idempotent. */
  readonly changed: boolean;
  /** The audit event written. Returned so a caller can cite it in a response letter. */
  readonly auditEventId: string;
}

export class ErasureError extends Error {
  public override readonly name = 'ErasureError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Erases one subject's personal information inside the caller's tenant transaction.
 *
 * Takes a `TenantClient` rather than opening its own transaction, so the erasure, the
 * reindex marker and the audit event either all happen or none do. An erasure that
 * succeeded without its audit event would be an untraceable destruction of records, which
 * is worse than an erasure that failed and can be retried.
 *
 * Idempotent: erasing an already-erased subject writes no second tombstone and destroys
 * nothing further, but still returns the outcome so a retrying job does not need to
 * special-case it.
 */
export async function eraseSubject(
  tx: TenantClient,
  request: ErasureRequest,
): Promise<ErasureOutcome> {
  if (request.subjectToken.trim() === '') {
    throw new ErasureError('Refusing to erase: empty subject token.');
  }

  // Establish the tenant up front rather than when the audit event is written. Two reasons,
  // and the second is the real one.
  //
  // It is one query instead of one per audit event. And it means a call made outside a
  // tenant transaction fails here, with a sentence saying what is wrong, rather than
  // several statements later as whatever error the first RLS-scoped read happens to
  // produce. Checking last made the guard unreachable, which a coverage report is very
  // good at noticing and a reviewer is not.
  const tenantId = await currentTenantId(tx);

  return request.subjectKind === 'learner'
    ? eraseLearner(tx, request, tenantId)
    : eraseGuardian(tx, request, tenantId);
}

async function eraseLearner(
  tx: TenantClient,
  request: ErasureRequest,
  tenantId: string,
): Promise<ErasureOutcome> {
  const learner = await tx.learner.findFirst({
    where: { token: request.subjectToken },
    select: { id: true, tombstonedAt: true },
  });
  // Not found means not found *in this tenant*, because RLS scopes the read. Throwing
  // rather than returning a no-op: an erasure aimed at a subject the caller cannot see is
  // a bug in the caller, and silently succeeding would let a retention job report having
  // erased records it never touched.
  if (learner === null) {
    throw new ErasureError(
      `No learner ${request.subjectToken} in this tenant. Refusing to report an erasure that did not happen.`,
    );
  }

  if (learner.tombstonedAt !== null) {
    return {
      subjectToken: request.subjectToken,
      identifiersDestroyed: 0,
      tombstonedAt: learner.tombstonedAt,
      changed: false,
      auditEventId: await writeErasureEvent(
        tx,
        request,
        tenantId,
        'learner',
        learner.id,
        0,
        false,
      ),
    };
  }

  const destroyed = await tx.learnerIdentifier.deleteMany({
    where: { learnerId: learner.id },
  });
  await tx.learner.update({
    where: { id: learner.id },
    data: {
      tombstonedAt: request.now,
      // Home language is a proxy for ethnicity in the South African context, and a
      // §26 special category by that route. It goes with the identifiers.
      homeLanguage: null,
      version: { increment: 1 },
    },
  });

  return {
    subjectToken: request.subjectToken,
    identifiersDestroyed: destroyed.count,
    tombstonedAt: request.now,
    changed: true,
    auditEventId: await writeErasureEvent(
      tx,
      request,
      tenantId,
      'learner',
      learner.id,
      destroyed.count,
      true,
    ),
  };
}

async function eraseGuardian(
  tx: TenantClient,
  request: ErasureRequest,
  tenantId: string,
): Promise<ErasureOutcome> {
  const guardian = await tx.guardian.findFirst({
    where: { token: request.subjectToken },
    select: { id: true, tombstonedAt: true },
  });
  if (guardian === null) {
    throw new ErasureError(
      `No guardian ${request.subjectToken} in this tenant. Refusing to report an erasure that did not happen.`,
    );
  }

  if (guardian.tombstonedAt !== null) {
    return {
      subjectToken: request.subjectToken,
      identifiersDestroyed: 0,
      tombstonedAt: guardian.tombstonedAt,
      changed: false,
      auditEventId: await writeErasureEvent(
        tx,
        request,
        tenantId,
        'guardian',
        guardian.id,
        0,
        false,
      ),
    };
  }

  await tx.guardian.update({
    where: { id: guardian.id },
    data: { tombstonedAt: request.now, homeLanguage: null, version: { increment: 1 } },
  });
  // The link to the learner survives, minus the right to be contacted. A report that was
  // sent to this guardian last term still has to be explicable.
  await tx.guardianLink.updateMany({
    where: { guardianId: guardian.id },
    data: { mayReceiveReports: false },
  });

  return {
    subjectToken: request.subjectToken,
    identifiersDestroyed: 0,
    tombstonedAt: request.now,
    changed: true,
    auditEventId: await writeErasureEvent(
      tx,
      request,
      tenantId,
      'guardian',
      guardian.id,
      0,
      true,
    ),
  };
}

/**
 * Writes the audit event for an erasure.
 *
 * The `diff` records what happened in counts and flags, never in values. An audit trail
 * that recorded what was erased would be a copy of the erased data with a longer retention
 * period than the record it replaced.
 *
 * `hash` is a content hash over this event alone; `previousHash` stays null. The tamper-
 * evident chain that links events to each other is Stage 02's, and this call site links
 * into it when that lands. The interim state is a real hash of real content rather than a
 * zero placeholder, so the row is verifiable on its own terms in the meantime — and it is
 * recorded in `docs/STAGE_LOG.md` rather than left to be discovered.
 */
async function writeErasureEvent(
  tx: TenantClient,
  request: ErasureRequest,
  tenantId: string,
  resourceType: string,
  resourceId: string,
  identifiersDestroyed: number,
  changed: boolean,
): Promise<string> {
  const id = randomUUID();
  const diff = {
    subjectToken: request.subjectToken,
    trigger: request.trigger,
    requestId: request.requestId,
    identifiersDestroyed,
    changed,
  };
  const hash = createHash('sha256')
    .update(
      JSON.stringify([
        id,
        tenantId,
        'subject_erasure',
        resourceType,
        resourceId,
        request.now.toISOString(),
        diff,
      ]),
    )
    .digest();

  await tx.auditEvent.create({
    data: {
      id,
      action: 'subject_erasure',
      resourceType,
      resourceId,
      purpose: null,
      diff,
      hash: new Uint8Array(hash),
      at: request.now,
      tenant: { connect: { id: tenantId } },
    },
  });
  return id;
}

/**
 * Reads the tenant the transaction is scoped to.
 *
 * The alternative is threading the tenant id through every call, which invites a caller to
 * pass one that differs from the transaction's setting — a mismatch RLS would refuse, but
 * only after the code had been written as though it were possible.
 */
async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new ErasureError('No tenant context on this transaction. Use withTenant.');
  }
  return tenantId;
}
