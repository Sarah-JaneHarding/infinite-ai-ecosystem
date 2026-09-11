import { describe, it, expect } from 'vitest';
import {
  assertTransitionAllowed,
  canSuspend,
  canReactivate,
  canClose,
  buildTransitionRecord,
  type TenantStatus,
} from '../src/lifecycle';

describe('assertTransitionAllowed', () => {
  it('allows ACTIVE → SUSPENDED', () => {
    expect(() => assertTransitionAllowed('ACTIVE', 'SUSPENDED')).not.toThrow();
  });

  it('allows ACTIVE → CLOSED', () => {
    expect(() => assertTransitionAllowed('ACTIVE', 'CLOSED')).not.toThrow();
  });

  it('allows SUSPENDED → ACTIVE', () => {
    expect(() => assertTransitionAllowed('SUSPENDED', 'ACTIVE')).not.toThrow();
  });

  it('allows SUSPENDED → CLOSED', () => {
    expect(() => assertTransitionAllowed('SUSPENDED', 'CLOSED')).not.toThrow();
  });

  it('throws on ACTIVE → ACTIVE (self-loop)', () => {
    expect(() => assertTransitionAllowed('ACTIVE', 'ACTIVE')).toThrow();
  });

  it('throws on CLOSED → ACTIVE (terminal)', () => {
    expect(() => assertTransitionAllowed('CLOSED', 'ACTIVE')).toThrow();
  });

  it('throws on CLOSED → SUSPENDED (terminal)', () => {
    expect(() => assertTransitionAllowed('CLOSED', 'SUSPENDED')).toThrow();
  });

  it('throws on CLOSED → CLOSED (terminal self-loop)', () => {
    expect(() => assertTransitionAllowed('CLOSED', 'CLOSED')).toThrow();
  });
});

describe('canSuspend', () => {
  it('returns true for ACTIVE', () => {
    expect(canSuspend('ACTIVE')).toBe(true);
  });

  it('returns false for SUSPENDED (already suspended)', () => {
    expect(canSuspend('SUSPENDED')).toBe(false);
  });

  it('returns false for CLOSED (terminal)', () => {
    expect(canSuspend('CLOSED')).toBe(false);
  });
});

describe('canReactivate', () => {
  it('returns true for SUSPENDED', () => {
    expect(canReactivate('SUSPENDED')).toBe(true);
  });

  it('returns false for ACTIVE (already active)', () => {
    expect(canReactivate('ACTIVE')).toBe(false);
  });

  it('returns false for CLOSED (terminal)', () => {
    expect(canReactivate('CLOSED')).toBe(false);
  });
});

describe('canClose', () => {
  it('returns true for ACTIVE', () => {
    expect(canClose('ACTIVE')).toBe(true);
  });

  it('returns true for SUSPENDED', () => {
    expect(canClose('SUSPENDED')).toBe(true);
  });

  it('returns false for CLOSED (already closed)', () => {
    expect(canClose('CLOSED')).toBe(false);
  });
});

describe('buildTransitionRecord', () => {
  it('returns a record with correct fields for a valid transition', () => {
    const record = buildTransitionRecord(
      'ACTIVE',
      'SUSPENDED',
      'unpaid invoice',
      'admin@school.za',
    );
    expect(record.from).toBe('ACTIVE');
    expect(record.to).toBe('SUSPENDED');
    expect(record.reason).toBe('unpaid invoice');
    expect(record.initiatedBy).toBe('admin@school.za');
    expect(record.at).toBeInstanceOf(Date);
  });

  it('throws on an invalid transition without persisting anything', () => {
    expect(() =>
      buildTransitionRecord('CLOSED', 'ACTIVE', 'tried to reopen', 'admin@school.za'),
    ).toThrow();
  });

  const validPairs: [TenantStatus, TenantStatus][] = [
    ['ACTIVE', 'SUSPENDED'],
    ['ACTIVE', 'CLOSED'],
    ['SUSPENDED', 'ACTIVE'],
    ['SUSPENDED', 'CLOSED'],
  ];

  for (const [from, to] of validPairs) {
    it(`succeeds for ${from} → ${to}`, () => {
      const record = buildTransitionRecord(from, to, 'test', 'actor');
      expect(record.from).toBe(from);
      expect(record.to).toBe(to);
    });
  }
});
