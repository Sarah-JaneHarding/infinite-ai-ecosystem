// Unit tests for prepareApproval — Stage 52.

import { describe, expect, it } from 'vitest';

import { prepareApproval } from '../src/approval.js';

describe('prepareApproval', () => {
  it('uses the run input as the artefact and records stepId/requiredRole as evidence', async () => {
    const material = await prepareApproval({
      runId: 'run-1',
      stepId: 'hod-approval',
      requiredRole: 'hod',
      input: { draft: 'lesson plan v1' },
    });

    expect(material.artefact).toEqual({ draft: 'lesson plan v1' });
    expect(material.evidence).toEqual({ stepId: 'hod-approval', requiredRole: 'hod' });
    expect(material.diffAgainstPrevious).toBeUndefined();
  });

  it('passes through whatever input shape the run carries, including null', async () => {
    const material = await prepareApproval({
      runId: 'run-2',
      stepId: 'sbst-review',
      requiredRole: 'sbst',
      input: null,
    });

    expect(material.artefact).toBeNull();
  });
});
