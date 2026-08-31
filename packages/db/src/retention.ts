// Ratified retention rules — Stage 05 step 8 (forgetting by design), plus the write side
// Stage 17's onboarding wizard needs.
//
// Stage 03 built a rule's shape and the arithmetic that evaluates it
// (`packages/contracts/src/popia/retention.ts`), but nothing in `packages/db` ever read a
// ratified rule back out of the database — the nightly job that would have needed this
// never had a schedule to run against either (`docs/STAGE_LOG.md`'s Stage 03 write-up,
// OQ-007). `getRetentionRule` is the one read the Brain's own retention resolution needs
// at the write path's `RETENTION_SCHEDULED` transition: "does a ratified rule exist for
// this category." `upsertRetentionRule` is the write side, added when OQ-007 gained a
// real per-tenant path to a ratified schedule: the onboarding wizard's
// `ratify_retention_schedule` step (`packages/provisioning`), pre-filled with
// `@infinite-ai/contracts`' `DEMO_RETENTION_ESTIMATES` for the demo/pilot release — a
// school accepts or amends them, and that acceptance is what this function persists.

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

/** What `upsertRetentionRule` needs to ratify (or re-ratify) one category — the same
 * fields `@infinite-ai/contracts`' `RetentionRule` validates before a caller ever reaches
 * this function; typed structurally here (not by importing that package) for the same
 * reason `RetentionRuleRow` already is — see this file's own `category`/`anchor` field
 * comments. */
export interface RetentionRuleInput {
  readonly category: string;
  readonly anchor: string;
  readonly retainMonths: number;
  readonly authority: string;
  readonly ratifiedAt: Date;
  readonly ratifiedBy: string;
}

/**
 * Ratifies the tenant's rule for `rule.category` — one row per (tenant, category), per
 * `@@unique([tenantId, category])`, so a second call for the same category is a
 * re-ratification (an amended period, a corrected authority), not a second row. `version`
 * starts at 1 on first ratification and increments by one on every re-ratification —
 * this table is "never versioned the way Brain facts are" (this file's own header), so
 * `version` is a plain re-ratification counter, not a supersession chain.
 *
 * The caller supplies `ratifiedAt`/`ratifiedBy` rather than this function inferring
 * them (`new Date()`, the connection's own role) for the same reason every other write
 * path in this codebase requires an explicit, caller-declared provenance: whether the
 * rule being written is a school's real determination or an onboarding-time estimate a
 * human just accepted, this is the one place that fact is recorded, and it must be true
 * of the actual event, not of when this function happened to run.
 */
export async function upsertRetentionRule(
  tx: TenantClient,
  rule: RetentionRuleInput,
): Promise<RetentionRuleRow> {
  const tenantId = await currentTenantId(tx);
  return tx.retentionRule.upsert({
    where: { tenantId_category: { tenantId, category: rule.category } },
    create: {
      tenantId,
      category: rule.category,
      anchor: rule.anchor,
      retainMonths: rule.retainMonths,
      authority: rule.authority,
      ratifiedAt: rule.ratifiedAt,
      ratifiedBy: rule.ratifiedBy,
    },
    update: {
      anchor: rule.anchor,
      retainMonths: rule.retainMonths,
      authority: rule.authority,
      ratifiedAt: rule.ratifiedAt,
      ratifiedBy: rule.ratifiedBy,
      version: { increment: 1 },
    },
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
