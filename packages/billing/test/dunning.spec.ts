import { describe, it, expect } from 'vitest';
import {
  applyDunningTrigger,
  initialiseDunning,
  isDunningTerminal,
  DunningTransitionError,
  type DunningState,
} from '../src/dunning';

const BASE_STATE: DunningState = {
  status: 'PAYMENT_DUE',
  invoiceId: 'inv-001',
  tenantId: 'tenant-abc',
  amountCents: 99_900,
  enteredAt: new Date('2026-08-01T00:00:00Z').toISOString(),
  noticeCount: 0,
};

describe('initialiseDunning', () => {
  it('creates a PAYMENT_DUE state with zero notices', () => {
    const state = initialiseDunning('tenant-x', 'inv-100', 50_000);
    expect(state.status).toBe('PAYMENT_DUE');
    expect(state.noticeCount).toBe(0);
    expect(state.tenantId).toBe('tenant-x');
    expect(state.invoiceId).toBe('inv-100');
    expect(state.amountCents).toBe(50_000);
  });

  it('uses the provided issuedAt date', () => {
    const at = new Date('2026-07-01T08:00:00Z');
    const state = initialiseDunning('t', 'i', 100, at);
    expect(state.enteredAt).toBe(at.toISOString());
  });
});

describe('applyDunningTrigger', () => {
  describe('PAYMENT_DUE state', () => {
    it('transitions to OVERDUE on GRACE_PERIOD_ELAPSED and increments notice count', () => {
      const next = applyDunningTrigger(BASE_STATE, 'GRACE_PERIOD_ELAPSED');
      expect(next.status).toBe('OVERDUE');
      expect(next.noticeCount).toBe(1);
    });

    it('transitions to PAID on PAYMENT_RECEIVED', () => {
      const next = applyDunningTrigger(BASE_STATE, 'PAYMENT_RECEIVED');
      expect(next.status).toBe('PAID');
    });

    it('resets to PAYMENT_DUE and clears noticeCount on INVOICE_ISSUED', () => {
      const state: DunningState = { ...BASE_STATE, noticeCount: 3 };
      const next = applyDunningTrigger(state, 'INVOICE_ISSUED');
      expect(next.status).toBe('PAYMENT_DUE');
      expect(next.noticeCount).toBe(0);
    });

    it('throws DunningTransitionError on SUSPENSION_THRESHOLD_ELAPSED from PAYMENT_DUE', () => {
      expect(() =>
        applyDunningTrigger(BASE_STATE, 'SUSPENSION_THRESHOLD_ELAPSED'),
      ).toThrow(DunningTransitionError);
    });

    it('throws DunningTransitionError on WRITE_OFF from PAYMENT_DUE', () => {
      expect(() => applyDunningTrigger(BASE_STATE, 'WRITE_OFF')).toThrow(
        DunningTransitionError,
      );
    });
  });

  describe('OVERDUE state', () => {
    const OVERDUE: DunningState = { ...BASE_STATE, status: 'OVERDUE', noticeCount: 1 };

    it('transitions to SUSPENDED on SUSPENSION_THRESHOLD_ELAPSED', () => {
      const next = applyDunningTrigger(OVERDUE, 'SUSPENSION_THRESHOLD_ELAPSED');
      expect(next.status).toBe('SUSPENDED');
    });

    it('transitions to PAID on PAYMENT_RECEIVED', () => {
      const next = applyDunningTrigger(OVERDUE, 'PAYMENT_RECEIVED');
      expect(next.status).toBe('PAID');
    });

    it('increments notice count on another GRACE_PERIOD_ELAPSED', () => {
      const next = applyDunningTrigger(OVERDUE, 'GRACE_PERIOD_ELAPSED');
      expect(next.noticeCount).toBe(2);
    });

    it('throws on INVOICE_ISSUED from OVERDUE', () => {
      expect(() => applyDunningTrigger(OVERDUE, 'INVOICE_ISSUED')).toThrow(
        DunningTransitionError,
      );
    });
  });

  describe('SUSPENDED state', () => {
    const SUSPENDED: DunningState = {
      ...BASE_STATE,
      status: 'SUSPENDED',
      noticeCount: 2,
    };

    it('transitions to PAID on PAYMENT_RECEIVED', () => {
      const next = applyDunningTrigger(SUSPENDED, 'PAYMENT_RECEIVED');
      expect(next.status).toBe('PAID');
    });

    it('transitions to CLOSED on WRITE_OFF', () => {
      const next = applyDunningTrigger(SUSPENDED, 'WRITE_OFF');
      expect(next.status).toBe('CLOSED');
    });

    it('throws on GRACE_PERIOD_ELAPSED from SUSPENDED', () => {
      expect(() => applyDunningTrigger(SUSPENDED, 'GRACE_PERIOD_ELAPSED')).toThrow(
        DunningTransitionError,
      );
    });
  });

  describe('terminal states', () => {
    it('throws on any trigger from PAID', () => {
      const paid: DunningState = { ...BASE_STATE, status: 'PAID' };
      expect(() => applyDunningTrigger(paid, 'INVOICE_ISSUED')).toThrow(
        DunningTransitionError,
      );
    });

    it('throws on any trigger from CLOSED', () => {
      const closed: DunningState = { ...BASE_STATE, status: 'CLOSED' };
      expect(() => applyDunningTrigger(closed, 'PAYMENT_RECEIVED')).toThrow(
        DunningTransitionError,
      );
    });
  });

  it('updates enteredAt on every transition', () => {
    const before = new Date('2026-08-10T00:00:00Z');
    const after = new Date('2026-08-17T00:00:00Z');
    const next = applyDunningTrigger(BASE_STATE, 'GRACE_PERIOD_ELAPSED', after);
    expect(next.enteredAt).toBe(after.toISOString());
    expect(next.enteredAt).not.toBe(before.toISOString());
  });
});

describe('isDunningTerminal', () => {
  it('returns false for PAYMENT_DUE', () => {
    expect(isDunningTerminal({ ...BASE_STATE, status: 'PAYMENT_DUE' })).toBe(false);
  });

  it('returns false for OVERDUE', () => {
    expect(isDunningTerminal({ ...BASE_STATE, status: 'OVERDUE' })).toBe(false);
  });

  it('returns false for SUSPENDED', () => {
    expect(isDunningTerminal({ ...BASE_STATE, status: 'SUSPENDED' })).toBe(false);
  });

  it('returns true for PAID', () => {
    expect(isDunningTerminal({ ...BASE_STATE, status: 'PAID' })).toBe(true);
  });

  it('returns true for CLOSED', () => {
    expect(isDunningTerminal({ ...BASE_STATE, status: 'CLOSED' })).toBe(true);
  });
});
