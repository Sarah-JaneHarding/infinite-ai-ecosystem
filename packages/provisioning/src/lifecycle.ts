// ---------------------------------------------------------------------------
// Tenant lifecycle state machine — Stage 17 step 6
//
// Valid transitions:
//   ACTIVE    → SUSPENDED   (unpaid invoice past dunning threshold, or admin)
//   SUSPENDED → ACTIVE      (payment received, or admin reactivation)
//   ACTIVE    → CLOSED      (POPIA deletion fulfilled, or voluntary closure)
//   SUSPENDED → CLOSED      (POPIA deletion fulfilled, or admin)
//
// CLOSED is terminal — no further transitions. The tenant row is retained so
// that the audit ledger's hash chain is not broken; all personal data is
// erased from tenant-owned tables.
// ---------------------------------------------------------------------------

export type TenantStatus = 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export type LifecycleTransition = 'suspend' | 'reactivate' | 'close';

export interface TransitionRecord {
  readonly from: TenantStatus;
  readonly to: TenantStatus;
  readonly reason: string;
  readonly initiatedBy: string;
  readonly at: Date;
}

const ALLOWED: ReadonlyMap<TenantStatus, ReadonlySet<TenantStatus>> = new Map([
  ['ACTIVE', new Set<TenantStatus>(['SUSPENDED', 'CLOSED'])],
  ['SUSPENDED', new Set<TenantStatus>(['ACTIVE', 'CLOSED'])],
  ['CLOSED', new Set<TenantStatus>()],
]);

/** Throws if the transition from → to is not permitted by the state machine. */
export function assertTransitionAllowed(from: TenantStatus, to: TenantStatus): void {
  if (!ALLOWED.get(from)?.has(to)) {
    throw new Error(`Tenant lifecycle: transition ${from} → ${to} is not permitted.`);
  }
}

/** Returns true when the tenant can be suspended. CLOSED tenants cannot. */
export function canSuspend(status: TenantStatus): boolean {
  return ALLOWED.get(status)?.has('SUSPENDED') ?? false;
}

/** Returns true when the tenant can be reactivated (i.e. was SUSPENDED). */
export function canReactivate(status: TenantStatus): boolean {
  return ALLOWED.get(status)?.has('ACTIVE') ?? false;
}

/**
 * Returns true when the tenant can be closed. Both ACTIVE and SUSPENDED
 * tenants can be closed; CLOSED is terminal.
 */
export function canClose(status: TenantStatus): boolean {
  return ALLOWED.get(status)?.has('CLOSED') ?? false;
}

/**
 * Builds a transition record. The caller must persist this and update the
 * tenant row atomically — assertTransitionAllowed is called here so any
 * invalid transition is caught before any write is attempted.
 */
export function buildTransitionRecord(
  from: TenantStatus,
  to: TenantStatus,
  reason: string,
  initiatedBy: string,
): TransitionRecord {
  assertTransitionAllowed(from, to);
  return { from, to, reason, initiatedBy, at: new Date() };
}
