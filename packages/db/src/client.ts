// The tenant-scoped database client — Stage 01 step 5.
//
// Rule 5: every database read and write goes through this. Row-Level Security is the
// second line of defence, not the first. A query that could execute without a tenant
// context is a security bug, so the only way to obtain a client from this package is to
// state which tenant and which actor you are acting as.
//
// The raw Prisma client is deliberately module-private. It is not exported from here and
// not re-exported from index.ts, so there is no import path to it from outside this
// package. An ESLint rule bans `@prisma/client` imports elsewhere, and a test asserts the
// export surface — three independent mechanisms, because any one of them could be
// weakened by someone in a hurry.

import { PrismaClient, type Prisma } from '@prisma/client';

/**
 * Identifies who is acting, and on whose behalf.
 *
 * `actorId` is not decoration: it lands in `app.actor_id` for the audit ledger's triggers
 * and in every audit event Stage 02 writes. An operation with no identifiable actor is
 * one nobody can be held to.
 */
export interface TenantContext {
  /** The tenant whose data is in scope. Becomes `app.tenant_id` for the transaction. */
  readonly tenantId: string;
  /** The user or service account performing the operation. Becomes `app.actor_id`. */
  readonly actorId: string;
}

/**
 * The client handed to callers: a Prisma transaction client with the tenant settings
 * already applied.
 *
 * `Prisma.TransactionClient` already excludes `$connect`, `$disconnect`, `$transaction`
 * and the other connection-management methods — which is exactly the property wanted here,
 * since those would let a caller step outside the transaction the tenant settings are
 * local to. Using Prisma's own type rather than a hand-written `Omit` means the exclusion
 * stays correct when Prisma adds a method.
 */
export type TenantClient = Prisma.TransactionClient;

/** Thrown when a tenant context is malformed. Never caught to continue. */
export class InvalidTenantContextError extends Error {
  public override readonly name = 'InvalidTenantContextError';

  constructor(message: string) {
    super(message);
  }
}

// Postgres settings are strings, and `set_config` would happily accept anything. Since
// these values become part of an RLS predicate, validate their shape before they get
// anywhere near the database rather than trusting the caller.
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new InvalidTenantContextError(
      `${label} must be a UUID. Refusing to open a tenant-scoped transaction.`,
    );
  }
}

let singleton: PrismaClient | undefined;

function client(): PrismaClient {
  singleton ??= new PrismaClient();
  return singleton;
}

/**
 * Overrides for Prisma's own interactive-transaction defaults (5000ms timeout, 2000ms
 * maxWait). Almost never needed — a request-scoped call should finish well inside the
 * default — but a batch or seed operation doing genuinely more work per call (many writes,
 * each going through the full audited Brain write-path) legitimately needs longer than an
 * API request ever should. Omit to keep Prisma's defaults.
 */
export interface WithTenantOptions {
  /** Forwarded to `$transaction`'s `timeout`. */
  readonly timeoutMs?: number;
  /** Forwarded to `$transaction`'s `maxWait`. */
  readonly maxWaitMs?: number;
}

/**
 * Runs `fn` inside a transaction scoped to one tenant.
 *
 * The scoping works by setting `app.tenant_id` and `app.actor_id` as **transaction-local**
 * settings — the third argument to `set_config` — which the RLS policies read via
 * `current_setting`. Transaction-local matters: a session-level setting would leak to the
 * next caller that borrowed the same pooled connection, which is precisely the
 * cross-tenant bug this whole layer exists to prevent.
 *
 * The values are passed as query parameters, never interpolated. String concatenation
 * into SQL is on the forbidden-patterns list, and a tenant ID is attacker-influenced in
 * any system with self-serve onboarding.
 *
 * @example
 * const learners = await withTenant({ tenantId, actorId }, (tx) =>
 *   tx.learner.findMany({ where: { gradeId } }),
 * );
 */
export async function withTenant<T>(
  context: TenantContext,
  fn: (tx: TenantClient) => Promise<T>,
  options?: WithTenantOptions,
): Promise<T> {
  assertUuid(context.tenantId, 'tenantId');
  assertUuid(context.actorId, 'actorId');

  // exactOptionalPropertyTypes (rule 8) means `{ timeout: options.timeoutMs }` is not the
  // same as omitting `timeout` when the value is undefined — Prisma's own option type
  // doesn't accept an explicit `undefined`, so each key is only set when actually provided.
  const transactionOptions: { timeout?: number; maxWait?: number } = {};
  if (options?.timeoutMs !== undefined) {
    transactionOptions.timeout = options.timeoutMs;
  }
  if (options?.maxWaitMs !== undefined) {
    transactionOptions.maxWait = options.maxWaitMs;
  }

  return client().$transaction(async (tx: TenantClient) => {
    await tx.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;
    await tx.$executeRaw`SELECT set_config('app.actor_id', ${context.actorId}, true)`;
    return fn(tx);
  }, transactionOptions);
}

/**
 * Closes the pooled connection. For process shutdown and test teardown only.
 *
 * Not a way to obtain a client — note that it returns void.
 */
export async function disconnect(): Promise<void> {
  if (singleton !== undefined) {
    await singleton.$disconnect();
    singleton = undefined;
  }
}
