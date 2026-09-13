// Unit tests for buildLeSignalInput — Stage 54.

import { describe, expect, it } from 'vitest';

import { buildLeSignalInput } from '../src/le-signal-trigger.js';

/** A minimal decided ApprovalTaskRow for a TB pipeline gate (all four LE context fields). */
function makeTbTask(
  overrides: Record<string, unknown> = {},
): Parameters<typeof buildLeSignalInput>[0] {
  return {
    id: 'aaaa0001-0000-0000-0000-000000000001',
    tenantId: 'dddd0001-0000-0000-0000-000000000001',
    runId: 'eeee0001-0000-0000-0000-000000000001',
    stepId: 'hod-approval',
    requiredRole: 'hod',
    artefact: {
      artefactId: 'bbbb0001-0000-0000-0000-000000000001',
      artefactType: 'lesson_plan',
      capsTopicId: 'caps-math-gr8-linear-eqs',
      agentId: 'TB-01',
    },
    diffAgainstPrevious: null,
    evidence: null,
    traceId: 'trace-0001',
    decision: 'APPROVED' as const,
    decidedBy: 'cccc0001-0000-0000-0000-000000000001',
    decidedAt: new Date('2026-09-13T10:00:00.000Z'),
    reason: null,
    editDiff: null,
    createdAt: new Date('2026-09-13T09:00:00.000Z'),
    updatedAt: new Date('2026-09-13T10:00:00.000Z'),
    ...overrides,
  };
}

describe('buildLeSignalInput', () => {
  it('returns a valid LE01Input for a decided TB gate', () => {
    const task = makeTbTask();
    const result = buildLeSignalInput(task, 'cccc0001-0000-0000-0000-000000000001');

    expect(result).not.toBeNull();
    expect(result?.tenantId).toBe('dddd0001-0000-0000-0000-000000000001');
    expect(result?.gateEventId).toBe('aaaa0001-0000-0000-0000-000000000001');
    expect(result?.agentId).toBe('TB-01');
    expect(result?.artefactId).toBe('bbbb0001-0000-0000-0000-000000000001');
    expect(result?.artefactType).toBe('lesson_plan');
    expect(result?.capsTopicId).toBe('caps-math-gr8-linear-eqs');
    expect(result?.eventType).toBe('approved');
    expect(result?.actorRef).toBe('cccc0001-0000-0000-0000-000000000001');
    expect(result?.decidedAt).toBe('2026-09-13T10:00:00.000Z');
    expect(result?.reasonCode).toBeUndefined();
  });

  it('maps REJECTED outcome to "rejected" event type', () => {
    const task = makeTbTask({ decision: 'REJECTED', reason: 'content-error' });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result?.eventType).toBe('rejected');
    expect(result?.reasonCode).toBe('content-error');
  });

  it('maps EDITED outcome to "edited" event type', () => {
    const task = makeTbTask({ decision: 'EDITED', reason: 'minor-fix' });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result?.eventType).toBe('edited');
    expect(result?.reasonCode).toBe('minor-fix');
  });

  it('propagates reasonCode when reason is present', () => {
    const task = makeTbTask({ decision: 'REJECTED', reason: 'curriculum-misalignment' });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result?.reasonCode).toBe('curriculum-misalignment');
  });

  it('omits reasonCode when reason is null', () => {
    const task = makeTbTask({ decision: 'APPROVED', reason: null });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result).not.toBeNull();
    expect('reasonCode' in (result ?? {})).toBe(false);
  });

  it('returns null when decision is null (task not yet decided)', () => {
    const task = makeTbTask({ decision: null, decidedAt: null });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result).toBeNull();
  });

  it('returns null when decidedAt is null even if decision is set', () => {
    const task = makeTbTask({ decidedAt: null });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result).toBeNull();
  });

  it('returns null for a non-TB gate (artefact lacks LE context fields)', () => {
    const task = makeTbTask({
      artefact: { someOtherField: 'mod-02 sbst gate, no LE context' },
    });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result).toBeNull();
  });

  it('returns null when artefact has LE context but artefactId is not a UUID', () => {
    const task = makeTbTask({
      artefact: {
        artefactId: 'not-a-uuid',
        artefactType: 'lesson_plan',
        capsTopicId: 'caps-topic-1',
        agentId: 'TB-01',
      },
    });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result).toBeNull();
  });

  it('returns null when artefact is null', () => {
    const task = makeTbTask({ artefact: null });
    const result = buildLeSignalInput(task, 'actor-uuid');

    expect(result).toBeNull();
  });

  it('passes through extra fields on artefact (passthrough schema)', () => {
    const task = makeTbTask({
      artefact: {
        artefactId: 'bbbb0001-0000-0000-0000-000000000001',
        artefactType: 'lesson_plan',
        capsTopicId: 'caps-math-gr8',
        agentId: 'TB-01',
        extraField: 'ignored by LE01Input but allowed by LeSignalContextSchema',
      },
    });
    const result = buildLeSignalInput(task, 'actor-uuid');

    // Extra fields on the artefact don't block the happy path
    expect(result).not.toBeNull();
    expect(result?.artefactType).toBe('lesson_plan');
  });
});
