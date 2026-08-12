// ---------------------------------------------------------------------------
// Dunning — Stage 17 step 4 + 5
//
// State machine for overdue invoice collection. Transitions:
//
//   PAYMENT_DUE → OVERDUE → SUSPENDED → CLOSED
//
// The machine is pure-functional: it takes current state + trigger event and
// returns the next state. Side-effects (sending emails, suspending accounts)
// are the caller's responsibility.
// ---------------------------------------------------------------------------

export type DunningStatus =
  | 'PAYMENT_DUE' // Invoice issued; within grace period
  | 'OVERDUE' // Grace period elapsed; first dunning notice sent
  | 'SUSPENDED' // Subscription suspended; service degraded
  | 'CLOSED' // Unrecoverable; tenant moved to lifecycle CLOSED
  | 'PAID'; // Invoice settled; terminal-success state

export type DunningTrigger =
  | 'INVOICE_ISSUED'
  | 'GRACE_PERIOD_ELAPSED'
  | 'PAYMENT_RECEIVED'
  | 'SUSPENSION_THRESHOLD_ELAPSED'
  | 'WRITE_OFF';

export interface DunningState {
  readonly status: DunningStatus;
  readonly invoiceId: string;
  readonly tenantId: string;
  readonly amountCents: number;
  // ISO-8601 timestamp when this state was entered.
  readonly enteredAt: string;
  // Number of dunning notices sent in this sequence.
  readonly noticeCount: number;
}

// Grace period: 7 calendar days from invoice issue before first dunning notice.
export const GRACE_PERIOD_DAYS = 7;
// Suspension: 14 calendar days overdue before service suspension.
export const SUSPENSION_THRESHOLD_DAYS = 14;

type AllowedTransitions = Readonly<Record<DunningStatus, ReadonlyArray<DunningTrigger>>>;

const ALLOWED_TRANSITIONS: AllowedTransitions = {
  PAYMENT_DUE: ['INVOICE_ISSUED', 'GRACE_PERIOD_ELAPSED', 'PAYMENT_RECEIVED'],
  OVERDUE: ['GRACE_PERIOD_ELAPSED', 'PAYMENT_RECEIVED', 'SUSPENSION_THRESHOLD_ELAPSED'],
  SUSPENDED: ['PAYMENT_RECEIVED', 'WRITE_OFF'],
  CLOSED: [],
  PAID: [],
};

export class DunningTransitionError extends Error {
  constructor(from: DunningStatus, trigger: DunningTrigger) {
    super(`Dunning: trigger '${trigger}' is not allowed from status '${from}'`);
  }
}

/**
 * Advances the dunning state machine. Returns the new state.
 * Throws DunningTransitionError on illegal transitions.
 */
export function applyDunningTrigger(
  current: DunningState,
  trigger: DunningTrigger,
  now: Date = new Date(),
): DunningState {
  const allowed = ALLOWED_TRANSITIONS[current.status];
  if (!allowed.includes(trigger)) {
    throw new DunningTransitionError(current.status, trigger);
  }

  const enteredAt = now.toISOString();

  switch (trigger) {
    case 'INVOICE_ISSUED':
      // Re-entering PAYMENT_DUE (e.g., reissued invoice) resets the counter.
      return { ...current, status: 'PAYMENT_DUE', enteredAt, noticeCount: 0 };

    case 'GRACE_PERIOD_ELAPSED':
      if (current.status === 'PAYMENT_DUE') {
        return {
          ...current,
          status: 'OVERDUE',
          enteredAt,
          noticeCount: current.noticeCount + 1,
        };
      }
      // Already OVERDUE — send another notice.
      return { ...current, enteredAt, noticeCount: current.noticeCount + 1 };

    case 'PAYMENT_RECEIVED':
      return { ...current, status: 'PAID', enteredAt };

    case 'SUSPENSION_THRESHOLD_ELAPSED':
      return { ...current, status: 'SUSPENDED', enteredAt };

    case 'WRITE_OFF':
      return { ...current, status: 'CLOSED', enteredAt };
  }
}

/**
 * Creates the initial dunning state when an invoice is first issued.
 */
export function initialiseDunning(
  tenantId: string,
  invoiceId: string,
  amountCents: number,
  issuedAt: Date = new Date(),
): DunningState {
  return {
    status: 'PAYMENT_DUE',
    invoiceId,
    tenantId,
    amountCents,
    enteredAt: issuedAt.toISOString(),
    noticeCount: 0,
  };
}

/**
 * Returns true when the dunning sequence has concluded (either paid or
 * written off). Callers should stop scheduling dunning jobs.
 */
export function isDunningTerminal(state: DunningState): boolean {
  return state.status === 'PAID' || state.status === 'CLOSED';
}
