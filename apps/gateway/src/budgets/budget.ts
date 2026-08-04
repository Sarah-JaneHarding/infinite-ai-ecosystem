// Budgets and quotas — Stage 04 step 5.
//
// "Per tenant, per module, per agent, per day and per month. Soft limit warns; hard limit
// refuses with a typed error the UI can explain. Budgets are enforced before the call, not
// after." The three clauses matter in that order: scope, softness, and timing. `check()`
// is the enforcement point, and it is called — by the server, in `server.ts` — before the
// router ever touches an adapter. Recording spend happens only after a call succeeds, so a
// failed provider call never counts against a tenant's budget.

export interface BudgetScope {
  readonly tenantId: string;
  readonly module: string;
  readonly agent: string;
}

export interface BudgetLimits {
  /** Estimated USD cost. Soft warns and proceeds; hard refuses before the call is made. */
  readonly softDailyLimit?: number;
  readonly hardDailyLimit?: number;
  readonly softMonthlyLimit?: number;
  readonly hardMonthlyLimit?: number;
}

export type BudgetVerdict =
  | { readonly allowed: true; readonly warning: string | null }
  | { readonly allowed: false; readonly reason: string };

export class BudgetExceededError extends Error {
  public override readonly name = 'BudgetExceededError';
  constructor(
    public readonly scope: BudgetScope,
    reason: string,
  ) {
    super(reason);
  }
}

interface Period {
  key: string;
  spent: number;
}

function dayKey(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function monthKey(at: Date): string {
  return at.toISOString().slice(0, 7);
}

function scopeKey(scope: BudgetScope): string {
  return `${scope.tenantId}::${scope.module}::${scope.agent}`;
}

export interface BudgetTrackerOptions {
  readonly now?: () => Date;
  /** No entry for a scope means unlimited — the school has not configured one yet. */
  readonly limitsFor: (scope: BudgetScope) => BudgetLimits | undefined;
}

/**
 * Tracks spend per scope, per day and per month, in memory.
 *
 * In-memory rather than Redis-backed: a single gateway process is the only deployment
 * shape this stage proves, and a multi-instance gateway sharing budget state across
 * processes needs a shared store — recorded as a deviation in `docs/STAGE_LOG.md` rather
 * than built silently short of what "per tenant... per day and per month" actually
 * requires in production.
 */
export class BudgetTracker {
  private readonly daily = new Map<string, Period>();
  private readonly monthly = new Map<string, Period>();
  private readonly now: () => Date;
  private readonly limitsFor: (scope: BudgetScope) => BudgetLimits | undefined;

  constructor(options: BudgetTrackerOptions) {
    this.now = options.now ?? (() => new Date());
    this.limitsFor = options.limitsFor;
  }

  /** Enforced before the call. Never mutates spend — that only happens in `record()`. */
  check(scope: BudgetScope): BudgetVerdict {
    const limits = this.limitsFor(scope);
    if (limits === undefined) return { allowed: true, warning: null };

    const at = this.now();
    const daySpent = this.daily.get(`${scopeKey(scope)}::${dayKey(at)}`)?.spent ?? 0;
    const monthSpent =
      this.monthly.get(`${scopeKey(scope)}::${monthKey(at)}`)?.spent ?? 0;

    if (limits.hardDailyLimit !== undefined && daySpent >= limits.hardDailyLimit) {
      return {
        allowed: false,
        reason: `Daily budget of ${limits.hardDailyLimit} exceeded for ${scope.module}/${scope.agent}.`,
      };
    }
    if (limits.hardMonthlyLimit !== undefined && monthSpent >= limits.hardMonthlyLimit) {
      return {
        allowed: false,
        reason: `Monthly budget of ${limits.hardMonthlyLimit} exceeded for ${scope.module}/${scope.agent}.`,
      };
    }

    const warnings: string[] = [];
    if (limits.softDailyLimit !== undefined && daySpent >= limits.softDailyLimit) {
      warnings.push(
        `daily spend ${daySpent.toFixed(4)} at or above soft limit ${limits.softDailyLimit}`,
      );
    }
    if (limits.softMonthlyLimit !== undefined && monthSpent >= limits.softMonthlyLimit) {
      warnings.push(
        `monthly spend ${monthSpent.toFixed(4)} at or above soft limit ${limits.softMonthlyLimit}`,
      );
    }
    return { allowed: true, warning: warnings.length > 0 ? warnings.join('; ') : null };
  }

  /** Throws {@link BudgetExceededError} instead of returning a refusal verdict. */
  assertWithinBudget(scope: BudgetScope): void {
    const verdict = this.check(scope);
    if (!verdict.allowed) throw new BudgetExceededError(scope, verdict.reason);
  }

  /** Adds a completed call's cost to the scope's running totals. Called after success. */
  record(scope: BudgetScope, costUsd: number): void {
    const at = this.now();
    const dailyKey = `${scopeKey(scope)}::${dayKey(at)}`;
    const monthlyKey = `${scopeKey(scope)}::${monthKey(at)}`;
    this.daily.set(dailyKey, {
      key: dailyKey,
      spent: (this.daily.get(dailyKey)?.spent ?? 0) + costUsd,
    });
    this.monthly.set(monthlyKey, {
      key: monthlyKey,
      spent: (this.monthly.get(monthlyKey)?.spent ?? 0) + costUsd,
    });
  }
}
