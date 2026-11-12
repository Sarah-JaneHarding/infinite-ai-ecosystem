import { describe, expect, it } from 'vitest';

import {
  LE_COMMONS_PIPELINE,
  LE_EVOLUTION_PIPELINE,
  LE_EXEMPLAR_PIPELINE,
  LE_PATTERN_PIPELINE,
  LE_SIGNAL_PIPELINE,
  MOD01_CURRICULUM_PIPELINE,
  MOD02_MONITORING_PIPELINE,
  MOD02_RTI_PIPELINE,
  MOD02_SBST_SCRIBE_PIPELINE,
  MOD03_WAREHOUSE_PIPELINE,
  MOD04_TOOLBOX_PIPELINE,
  MOD05_CPTD_PIPELINE,
  MOD05_PD_ANALYSIS_PIPELINE,
  type PipelineDefinition,
} from '@infinite-ai/orchestrator';
import { isSchoolStaffRole } from '@infinite-ai/policy';

// OQ-046: a human gate whose `requiredRole` is not a role provisioning can grant waits for an approval
// no real account can give. Every gate in every pipeline must name a role an invitation or grant
// request can carry — except the ones listed below, each of which is an owner decision still to be
// built. The list is a ratchet, not an exemption: an entry that stops being used, or that has become
// grantable, fails this test until it is removed, and a new ungrantable role cannot be added to it
// without this file changing in review.
const PIPELINES: readonly PipelineDefinition[] = [
  MOD01_CURRICULUM_PIPELINE,
  MOD02_RTI_PIPELINE,
  MOD02_MONITORING_PIPELINE,
  MOD02_SBST_SCRIBE_PIPELINE,
  MOD03_WAREHOUSE_PIPELINE,
  MOD04_TOOLBOX_PIPELINE,
  MOD05_PD_ANALYSIS_PIPELINE,
  MOD05_CPTD_PIPELINE,
  LE_SIGNAL_PIPELINE,
  LE_PATTERN_PIPELINE,
  LE_EVOLUTION_PIPELINE,
  LE_EXEMPLAR_PIPELINE,
  LE_COMMONS_PIPELINE,
];

/** Empty since `sbst_chair` was built (OQ-046). An entry here is an owner decision still to be built. */
const AWAITING_ROLE: readonly string[] = [];

const gates = PIPELINES.flatMap((pipeline) =>
  Object.values(pipeline.steps).flatMap((step) =>
    step.kind === 'human_gate'
      ? [{ pipeline: pipeline.id, step: step.id, role: step.requiredRole }]
      : [],
  ),
);

describe('every human gate can be decided by someone', () => {
  it('finds the gates (guards the walk itself)', () => {
    expect(gates.length).toBeGreaterThanOrEqual(10);
  });

  it.each(gates.map((g) => [`${g.pipeline} / ${g.step} → ${g.role}`, g] as const))(
    '%s names a role provisioning can grant, or one awaiting its own change',
    (_name, gate) => {
      expect(
        isSchoolStaffRole(gate.role) || AWAITING_ROLE.includes(gate.role),
        `${gate.pipeline}/${gate.step} requires "${gate.role}", which no invitation or grant request can carry`,
      ).toBe(true);
    },
  );

  it('keeps no role on the awaiting list that is already grantable or no longer used', () => {
    for (const role of AWAITING_ROLE) {
      expect(
        isSchoolStaffRole(role),
        `${role} is grantable now: remove it from the list`,
      ).toBe(false);
      expect(
        gates.some((g) => g.role === role),
        `${role} no gate uses it any more: remove it from the list`,
      ).toBe(true);
    }
  });

  it('the roles OQ-046 replaced are gone', () => {
    for (const gone of ['lse', 'data_manager']) {
      expect(gates.map((g) => g.role)).not.toContain(gone);
    }
  });
});
