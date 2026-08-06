// Per-tenant and per-agent concurrency limits — Stage 06 step 8.
//
// "Per-tenant and per-agent concurrency limits, queue fairness so one large tenant cannot
// starve others, and a circuit breaker per provider." This module is the first of those
// three: a plain in-memory counter, keyed by tenant and separately by agent, that refuses
// to hand out a slot once either cap is reached. Single-process only — a shared limit
// across multiple worker processes needs a store every process can see (Redis, the same
// gap `apps/gateway/src/budgets/budget.ts`'s own header already names and defers for
// exactly this reason), which is a stated follow-up, not a silent gap: nothing today runs
// more than one orchestrator process against the same tenant.
//
// `runner.ts` treats a refused slot the same way it already treats a retry not yet due or
// a step still within its timeout: no progress this call, not a failure — the same
// resumability idiom the rest of this package already uses, so a caller polling back in
// later (once some other run has released a slot) needs no new run status to understand.

export interface ConcurrencyLimits {
  readonly maxPerTenant: number;
  readonly maxPerAgent: number;
}

/** Held for the duration of one step execution attempt, released immediately after —
 * never held across a step's own retry lifecycle, only while work is actually running. */
export interface ConcurrencySlot {
  release(): void;
}

export class ConcurrencyLimiter {
  private readonly perTenant = new Map<string, number>();
  private readonly perAgent = new Map<string, number>();

  constructor(private readonly limits: ConcurrencyLimits) {}

  /** `null` means at capacity for either the tenant or the agent — the caller makes no
   * progress this call, the same as any other "not yet" condition in this package. */
  tryAcquire(tenantId: string, agentId: string): ConcurrencySlot | null {
    const tenantCount = this.perTenant.get(tenantId) ?? 0;
    const agentCount = this.perAgent.get(agentId) ?? 0;
    if (tenantCount >= this.limits.maxPerTenant) return null;
    if (agentCount >= this.limits.maxPerAgent) return null;

    this.perTenant.set(tenantId, tenantCount + 1);
    this.perAgent.set(agentId, agentCount + 1);

    let released = false;
    return {
      release: () => {
        if (released) return; // idempotent — a caller's finally block may run twice
        released = true;
        this.perTenant.set(
          tenantId,
          Math.max(0, (this.perTenant.get(tenantId) ?? 1) - 1),
        );
        this.perAgent.set(agentId, Math.max(0, (this.perAgent.get(agentId) ?? 1) - 1));
      },
    };
  }

  tenantInFlight(tenantId: string): number {
    return this.perTenant.get(tenantId) ?? 0;
  }

  agentInFlight(agentId: string): number {
    return this.perAgent.get(agentId) ?? 0;
  }
}
