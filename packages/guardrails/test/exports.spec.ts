// What the package offers, and specifically what it does not: rule 4 says there is no
// escape hatch on the egress guard, and the export list is where one would be added.

import { describe, expect, it } from 'vitest';

import * as guardrails from '../src/index.js';

describe('package export surface', () => {
  it('exports the guard, the guardrail engine, and nothing else', () => {
    expect(Object.keys(guardrails).sort()).toEqual([
      'DIAGNOSTIC_TERMS',
      'EscalationRoute',
      'GuardrailEscalationError',
      'LabelledCase',
      'LabelledCoverage',
      'NO_VERDICT_PREFIX',
      'PACKAGE_NAME',
      'PASSED',
      'PiiEgressError',
      'Refusal',
      'RefusalReasonCode',
      'assertEgressAllowed',
      'buildTemplateFidelityChecker',
      'checkAgeAppropriateness',
      'checkCost',
      'checkDiagnosticLanguage',
      'checkGrounding',
      'checkInputSchema',
      'checkLabelledSet',
      'checkOutputSchema',
      'checkPii',
      'checkPromptInjection',
      'checkPurposeAndConsent',
      'checkReadability',
      'checkRefusalPolicy',
      'checkTemplateFidelity',
      'checkTokenBudget',
      'createBrainAgeAppropriatenessChecker',
      'createGatewayAgeAppropriatenessJudge',
      'defaultEscalationNotifier',
      'extractFreeText',
      'inspectEgress',
      'isNoVerdict',
      'refuse',
      'runCalibration',
      'runInputGuardrails',
      'runOutputGuardrails',
      'scoreReadability',
      'selectCases',
      'summariseCalibration',
    ]);
  });

  it('exports no bypass, allow-list or force flag', () => {
    // Each of these would be added for a good reason on a busy afternoon. Naming them here
    // means the diff that adds one also has to delete this test, which is a conversation.
    for (const name of Object.keys(guardrails)) {
      expect(name.toLowerCase()).not.toMatch(
        /bypass|allowlist|force|skip|override|disable/,
      );
    }
  });
});
