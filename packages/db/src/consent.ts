// The consent ledger's write and read path — Stage 03 step 6.
//
// Two functions, and the asymmetry between them is the design. `appendConsentEntry` is the
// only way a consent record is created, and there is no update and no delete — the database
// refuses both via a trigger, so this module could not offer them even if someone added
// them here.
//
// `readLedger` returns the whole history for a subject rather than a computed answer.
// Evaluation lives in `@infinite-ai/policy`, pure and testable without a database, and this
// package's job is to hand it the rows. Putting the decision logic in a SQL query would
// make "were we permitted to do this last March?" a question requiring a database and a
// carefully worded WHERE clause, rather than a function call with a date argument.

import type { ConsentDecision, ConsentSource, LawfulBasis } from '@prisma/client';

import type { TenantClient } from './client.js';

/**
 * The database representation of a ledger entry. Mirrors the `consent_record` table.
 *
 * `category` and `purpose` are strings here rather than unions, because the taxonomy lives
 * in `@infinite-ai/contracts` and is versioned there — storing it as a Postgres enum would
 * make adding a purpose a migration rather than a reviewed change to one table. The three
 * POPIA vocabularies that *are* enums (`basis`, `decision`, `source`) come from the Act and
 * do not change with the product. `consent-enums.spec.ts` asserts the two generators agree.
 */
export interface ConsentRow {
  readonly id: string;
  readonly tenantId: string;
  readonly subjectToken: string;
  readonly category: string;
  readonly purpose: string;
  readonly basis: LawfulBasis;
  readonly decision: ConsentDecision;
  readonly source: ConsentSource;
  readonly evidenceRef: string | null;
  readonly effectiveFrom: Date;
  readonly recordedAt: Date;
  readonly recordedBy: string | null;
  readonly note: string | null;
}

export interface ConsentAppend {
  readonly subjectToken: string;
  readonly category: string;
  readonly purpose: string;
  readonly basis: LawfulBasis;
  readonly decision: ConsentDecision;
  readonly source: ConsentSource;
  readonly evidenceRef: string | null;
  readonly effectiveFrom: Date;
  readonly recordedBy: string | null;
  readonly note: string | null;
}

export class ConsentLedgerError extends Error {
  public override readonly name = 'ConsentLedgerError';
  constructor(message: string) {
    super(message);
  }
}

/**
 * Appends one entry. The only write path into the ledger.
 *
 * Validation of the entry's *shape* — that a consent-based grant carries evidence, that
 * `effectiveFrom` is not in the future of `recordedAt` — belongs to the `ConsentEntry`
 * schema in `@infinite-ai/contracts` and is applied by the caller. This function's own
 * check is narrower and structural: it refuses a future-dated effective date outright,
 * because a ledger nothing can amend must not be able to hold an entry that turns itself on
 * later.
 */
export async function appendConsentEntry(
  tx: TenantClient,
  entry: ConsentAppend,
  now: Date,
): Promise<ConsentRow> {
  if (entry.effectiveFrom.getTime() > now.getTime()) {
    throw new ConsentLedgerError(
      'Refusing a future-dated consent entry. The ledger cannot be amended, so an entry ' +
        'that takes effect later cannot be withdrawn before it does.',
    );
  }
  if (entry.subjectToken.trim() === '') {
    throw new ConsentLedgerError('Refusing a consent entry with no subject.');
  }

  const tenantId = await currentTenantId(tx);
  const created = await tx.consentRecord.create({
    data: {
      tenantId,
      subjectToken: entry.subjectToken,
      category: entry.category,
      purpose: entry.purpose,
      basis: entry.basis,
      decision: entry.decision,
      source: entry.source,
      evidenceRef: entry.evidenceRef,
      effectiveFrom: entry.effectiveFrom,
      recordedAt: now,
      recordedBy: entry.recordedBy,
      note: entry.note,
    },
  });
  return created as ConsentRow;
}

/**
 * Every entry for one subject, oldest first.
 *
 * Deliberately not filtered by category or purpose. A caller asking "may I read this
 * learner's attendance for screening?" needs the answer for that one question, but the
 * evaluation is cheap and the whole ledger for one child is a handful of rows — whereas a
 * narrowly filtered read is the shape that later grows a `LIMIT 1 ORDER BY … DESC` and
 * quietly reintroduces the mutable-state model this table exists to avoid.
 */
export async function readLedger(
  tx: TenantClient,
  subjectToken: string,
): Promise<readonly ConsentRow[]> {
  const rows = await tx.consentRecord.findMany({
    where: { subjectToken },
    orderBy: [{ effectiveFrom: 'asc' }, { recordedAt: 'asc' }],
  });
  return rows as ConsentRow[];
}

/** Every entry in the tenant, for the objection queue and the retention sweep. */
export async function readTenantLedger(tx: TenantClient): Promise<readonly ConsentRow[]> {
  const rows = await tx.consentRecord.findMany({
    orderBy: [{ effectiveFrom: 'asc' }, { recordedAt: 'asc' }],
  });
  return rows as ConsentRow[];
}

async function currentTenantId(tx: TenantClient): Promise<string> {
  const rows = await tx.$queryRaw<
    { tenant_id: string }[]
  >`SELECT current_setting('app.tenant_id', false) AS tenant_id`;
  const tenantId = rows[0]?.tenant_id;
  if (tenantId === undefined || tenantId === '') {
    throw new ConsentLedgerError(
      'No tenant context on this transaction. Use withTenant.',
    );
  }
  return tenantId;
}
