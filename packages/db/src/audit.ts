// The append-only, hash-chained audit ledger's persistence — Stage 05 step 7.
//
// `packages/telemetry/src/audit.ts` built the pure hash-chain logic (`canonicalise`,
// `hashEvent`, `chainEvent`, `verifyChain`) back in Stage 02; nothing in `packages/db`
// called it until now. The one existing writer, `erasure.ts`'s `writeErasureEvent`
// (Stage 03), leaves `previousHash` null — an interim state its own comment already
// documents and defers to "when [the chain] lands." This is that landing:
// `appendAuditEvent` reads the tenant's current last hash, chains the new event onto it,
// and inserts — general enough for any future caller, not only Brain writes, which is
// what step 7's "immutable read/write audit trail" needs it for first (see
// `packages/brain/src/write-path.ts`, which now calls this on every write-path
// transition — the append-only record of *how* a fact got here that the mutable
// `brain_write_candidate` row, by itself, no longer shows once a later transition has
// overwritten its `status`).
//
// A Postgres advisory lock, scoped to the transaction, serializes concurrent appends for
// the same tenant: without it, two transactions racing to write an event could both read
// the same "last" hash and each chain onto it, forking the ledger — a broken chain nobody
// would notice until an audit tried to walk it. The lock is released automatically at
// commit or rollback; nothing here needs to remember to release it. Nothing else in this
// codebase takes a Postgres advisory lock, so there is no shared key space this could
// collide with.

import { chainEvent, type AuditEventInput } from '@infinite-ai/telemetry';
import type { Prisma } from '@prisma/client';

import type { TenantClient } from './client.js';

export class AuditError extends Error {
  public override readonly name = 'AuditError';
  constructor(message: string) {
    super(message);
  }
}

export interface AppendAuditEventInput {
  readonly actorId: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly purpose: string | null;
  readonly traceId: string | null;
  /** Never plaintext personal information — the same boundary every other audit write in
   * this schema already holds itself to. */
  readonly diff: unknown;
  readonly at: Date;
  readonly createdBy: string | null;
}

export interface AppendedAuditEvent {
  readonly id: string;
  readonly hash: Buffer;
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new AuditError('No tenant context on this transaction. Use withTenant.');
  }
  return tenantId;
}

/**
 * Appends one event onto the tenant's audit chain, inside the same transaction as
 * whatever it is recording — so the event and the write it describes commit or roll back
 * together, and nothing can be persisted (or fail to be) without also being logged.
 */
export async function appendAuditEvent(
  tx: TenantClient,
  input: AppendAuditEventInput,
): Promise<AppendedAuditEvent> {
  const tenantId = await currentTenantId(tx);

  // Serializes concurrent appends for this tenant; see the module header. Once this
  // resolves, this transaction is the only one that can be reading or writing the head of
  // this tenant's chain until it commits or rolls back.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId})::bigint)`;

  const last = await tx.auditEvent.findFirst({
    where: { tenantId },
    orderBy: [{ at: 'desc' }, { id: 'desc' }],
    select: { hash: true },
  });
  const previousHash = last === null ? null : Buffer.from(last.hash);

  const eventInput: AuditEventInput = {
    tenantId,
    actorId: input.actorId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    purpose: input.purpose,
    traceId: input.traceId,
    diff: input.diff,
    at: input.at,
  };
  const chained = chainEvent(eventInput, previousHash);

  const created = await tx.auditEvent.create({
    data: {
      tenantId,
      actorId: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      purpose: input.purpose,
      traceId: input.traceId,
      diff: input.diff as Prisma.InputJsonValue,
      previousHash:
        chained.previousHash === null ? null : new Uint8Array(chained.previousHash),
      hash: new Uint8Array(chained.hash),
      at: input.at,
      createdBy: input.createdBy,
    },
    select: { id: true, hash: true },
  });
  return { id: created.id, hash: Buffer.from(created.hash) };
}
