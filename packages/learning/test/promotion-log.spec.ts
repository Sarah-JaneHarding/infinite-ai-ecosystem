// Promotion log unit tests — Stage 13 step 10.
//
// "A rollback restores the previous champion exactly" (manual step 10).
// Covers append, current champion, rollback, and multi-agent isolation.

import { describe, expect, it } from 'vitest';

import { PromotionLog } from '../src/index.js';

const makeEntry = (
  overrides: Partial<{
    promotionId: string;
    agentId: string;
    previousChampionVersion: string;
    newChampionVersion: string;
  }> = {},
) => ({
  promotionId: overrides.promotionId ?? '00000000-0000-0000-0000-000000000001',
  tenantId: '11111111-2222-3333-4444-555555555555',
  agentId: overrides.agentId ?? 'LE-06',
  challengerId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  previousChampionVersion: overrides.previousChampionVersion ?? '1.0.0',
  newChampionVersion: overrides.newChampionVersion ?? '1.1.0',
  evalDeltaSummary: 'Overall pass rate improved from 80% to 90%.',
  ratifiedBy: 'hod-role-token',
  ratifiedAt: '2026-08-01T12:00:00.000Z',
  promotedAt: '2026-08-01T12:00:00.000Z',
});

describe('PromotionLog', () => {
  it('appends an entry and returns a rollback command', () => {
    const log = new PromotionLog();
    const record = log.append(makeEntry());
    expect(record.entry.agentId).toBe('LE-06');
    expect(record.rollbackCommand).toContain('LE-06');
    expect(record.rollbackCommand).toContain('1.0.0');
  });

  it('currentChampion returns the most recently promoted version', () => {
    const log = new PromotionLog();
    log.append(makeEntry({ newChampionVersion: '1.1.0' }));
    log.append(
      makeEntry({
        previousChampionVersion: '1.1.0',
        newChampionVersion: '1.2.0',
        promotionId: '00000000-0000-0000-0000-000000000002',
      }),
    );
    expect(log.currentChampion('LE-06')).toBe('1.2.0');
  });

  it('currentChampion returns null for an agent with no promotions', () => {
    const log = new PromotionLog();
    expect(log.currentChampion('LE-06')).toBeNull();
  });

  it('rollback returns the previous version exactly', () => {
    const log = new PromotionLog();
    log.append(
      makeEntry({ previousChampionVersion: '1.0.0', newChampionVersion: '1.1.0' }),
    );
    const rb = log.rollback('LE-06');
    expect(rb).not.toBeNull();
    expect(rb?.previousVersion).toBe('1.0.0');
  });

  it('rollback returns null when no promotions exist for the agent', () => {
    const log = new PromotionLog();
    expect(log.rollback('LE-06')).toBeNull();
  });

  it('does not mutate the log on rollback — entries are still there', () => {
    const log = new PromotionLog();
    log.append(makeEntry());
    log.rollback('LE-06');
    expect(log.allEntries()).toHaveLength(1);
  });

  it('isolates entries by agentId — two agents do not share rollback state', () => {
    const log = new PromotionLog();
    log.append(makeEntry({ agentId: 'LE-06', previousChampionVersion: 'v1' }));
    log.append(
      makeEntry({
        agentId: 'LE-05',
        previousChampionVersion: 'v2',
        promotionId: '00000000-0000-0000-0000-000000000002',
      }),
    );
    expect(log.currentChampion('LE-06')).toBe('1.1.0');
    expect(log.rollback('LE-05')?.previousVersion).toBe('v2');
    expect(log.rollback('LE-06')?.previousVersion).toBe('v1');
  });

  it('rollback command includes the promotion ID for traceability', () => {
    const log = new PromotionLog();
    const record = log.append(
      makeEntry({ promotionId: 'deadbeef-dead-beef-dead-beefdeadbeef' }),
    );
    expect(record.rollbackCommand).toContain('deadbeef-dead-beef-dead-beefdeadbeef');
  });
});
