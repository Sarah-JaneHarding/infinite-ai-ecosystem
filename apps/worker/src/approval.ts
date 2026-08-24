// The human_gate approval-material provider — Stage 52.
//
// `runner.ts`'s own `advanceRun` refuses to execute a `human_gate` step at all without a
// `prepareApproval` function (`RunnerOptions.prepareApproval`); until this file existed,
// every pipeline with a human gate — MOD-01's hod-approval, MOD-02's sbst-review and
// parent-letter-review, MOD-04's every-artefact gate, MOD-05's hod-approval, LE's
// promotion/exemplar/commons ratifications — would throw the moment a run reached one,
// exactly the same class of gap Stage 51 found and fixed for tool_call steps.
//
// `artefact` is the run's own input — the one thing genuinely available here. Everything a
// step produces is still evaluated against that same static run input throughout the run
// (`packages/orchestrator/src/runner.ts`'s own header, and `docs/STAGE_LOG.md`'s Stage 06
// step 5 entry: "every step today reads the run's original input, not a previous step's
// output — a simplification step 4 already made"), so this provider does not attempt to
// reconstruct "what the agent actually drafted" from a prior step's output — there is
// nothing durable here for a human gate to read that back from yet. `diffAgainstPrevious`
// is omitted, the same "nothing to diff against" honest gap `ApprovalMaterial`'s own field
// comment already documents.

import type { ApprovalMaterialProvider } from '@infinite-ai/orchestrator';

export const prepareApproval: ApprovalMaterialProvider = (context) => ({
  artefact: context.input,
  evidence: { stepId: context.stepId, requiredRole: context.requiredRole },
});
