import {
  DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS,
  SASA_1996_SECTIONS,
} from '@infinite-ai/contracts';

import type { ComplianceFinding, FeesInput } from '../types.js';

/** Quintiles 1-3 are classified as no-fee schools under the DoE 2003 Plan. */
const NO_FEE_QUINTILES = new Set([1, 2, 3]);

export function checkFees(input: FeesInput): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  if (NO_FEE_QUINTILES.has(input.quintile) && input.schoolFeeCharged) {
    findings.push({
      area: 'SCHOOL_FEES',
      severity: 'VIOLATION',
      code: 'NO_FEE_SCHOOL_CHARGING_FEES',
      description: `Quintile ${input.quintile} schools are classified as no-fee schools. Charging school fees at a no-fee school contravenes SASA §39 read with the DoE Plan of Action (2003) quintile classification framework.`,
      basis: DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS.quintileClassification,
    });
  }

  if (!NO_FEE_QUINTILES.has(input.quintile) && !input.feeExemptionProcedureInPlace) {
    findings.push({
      area: 'SCHOOL_FEES',
      severity: 'VIOLATION',
      code: 'NO_FEE_EXEMPTION_PROCEDURE',
      description: `Quintile ${input.quintile} schools that charge fees must have a fee exemption procedure in place. SASA §39 requires that parents who cannot afford school fees be exempted; the absence of an exemption procedure is a breach of this obligation.`,
      basis: SASA_1996_SECTIONS.schoolFees,
    });
  }

  if (NO_FEE_QUINTILES.has(input.quintile) && !input.feeExemptionProcedureInPlace) {
    findings.push({
      area: 'SCHOOL_FEES',
      severity: 'INFO',
      code: 'NO_FEE_SCHOOL_MISSING_EXEMPTION_PROCEDURE',
      description: `Quintile ${input.quintile} no-fee schools do not charge fees, but documenting a fee-exemption procedure is still good practice in case the quintile classification changes.`,
      basis: DOE_FREE_QUALITY_EDUCATION_2003_SECTIONS.feeExemptions,
    });
  }

  return findings;
}
