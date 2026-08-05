// Ratified retention rules, read back — Stage 05 step 8 (forgetting by design).
//
// Stage 03 built a rule's shape and the arithmetic that evaluates it
// (`packages/contracts/src/popia/retention.ts`), but nothing in `packages/db` ever read a
// ratified rule back out of the database — the nightly job that would have needed this
// never had a schedule to run against either (`docs/STAGE_LOG.md`'s Stage 03 write-up,
// OQ-007). This is the one read the Brain's own retention resolution needs at the write
// path's `RETENTION_SCHEDULED` transition: "does a ratified rule exist for this category."

import type { TenantClient } from './client.js';

export class RetentionError extends Error {
  public override readonly name = 'RetentionError';
  constructor(message: string) {
    super(message);
  }
}

export interface RetentionRuleRow {
  readonly id: string;
  /** A `DataCategory` value from `@infinite-ai/contracts`. */
  readonly category: string;
  /** A `RetentionAnchor` value from `@infinite-ai/contracts`. */
  readonly anchor: string;
  readonly retainMonths: number;
  readonly authority: string;
  readonly ratifiedAt: Date;
  readonly ratifiedBy: string;
  readonly version: number;
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new RetentionError('No tenant context on this transaction. Use withTenant.');
  }
  return tenantId;
}

/**
 * The tenant's ratified rule for `category`, if one exists. `@@unique([tenantId,
 * category])` on `retention_rule` is what makes this a single lookup rather than a "which
 * version is current" question: a schedule is one row per category, never versioned the
 * way Brain facts are. Null means unscheduled — never tombstoned automatically, the same
 * honesty `packages/contracts`'s own `unscheduledCategories` already names.
 */
export async function getRetentionRule(
  tx: TenantClient,
  category: string,
): Promise<RetentionRuleRow | null> {
  const tenantId = await currentTenantId(tx);
  return tx.retentionRule.findUnique({
    where: { tenantId_category: { tenantId, category } },
    select: {
      id: true,
      category: true,
      anchor: true,
      retainMonths: true,
      authority: true,
      ratifiedAt: true,
      ratifiedBy: true,
      version: true,
    },
  });
}
