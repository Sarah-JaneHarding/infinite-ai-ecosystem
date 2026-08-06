// Queue fairness across tenants — Stage 06 step 8.
//
// "Queue fairness so one large tenant cannot starve others." A real scheduler — something
// that holds many pending runs across many tenants and repeatedly decides which to advance
// next — needs a real queue behind it (BullMQ, the same infrastructure Stage 06 step 4
// already deferred until `apps/worker` has a real consumer to hand jobs to). That
// scheduler does not exist yet; the fairness *algorithm* it will need does, and is provable
// on its own terms without one: a round-robin selector over tenants, not over runs, so a
// tenant with a thousand pending runs is served no more often per rotation than a tenant
// with one.
//
// Pure and resumable, like everything else in this package: `lastServedTenantId` is the
// only memory carried between calls, threaded back in explicitly rather than held in a
// closure — the same shape `advanceRun` already uses for a run's own persisted state.

export interface FairnessCandidate {
  readonly runId: string;
  readonly tenantId: string;
}

/**
 * Picks the next candidate to advance, rotating fairly across the distinct tenants
 * represented in `candidates` — the same tenant is not served twice before every other
 * tenant with at least one pending candidate has had a turn. Ties within a tenant (more
 * than one pending run for the same tenant) are broken by `candidates`' own order, so a
 * caller that always appends new work to the end gets a stable, oldest-first pick within
 * a tenant.
 */
export function selectNextFairly(
  candidates: readonly FairnessCandidate[],
  lastServedTenantId: string | null,
): FairnessCandidate | null {
  if (candidates.length === 0) return null;

  const tenantOrder: string[] = [];
  for (const candidate of candidates) {
    if (!tenantOrder.includes(candidate.tenantId)) tenantOrder.push(candidate.tenantId);
  }

  const lastIndex =
    lastServedTenantId === null ? -1 : tenantOrder.indexOf(lastServedTenantId);
  const startIndex = (lastIndex + 1) % tenantOrder.length;

  for (let offset = 0; offset < tenantOrder.length; offset++) {
    const tenantId = tenantOrder[(startIndex + offset) % tenantOrder.length]!;
    const match = candidates.find((candidate) => candidate.tenantId === tenantId);
    if (match !== undefined) return match;
  }

  return null; // unreachable — every tenant in tenantOrder has at least one candidate
}
