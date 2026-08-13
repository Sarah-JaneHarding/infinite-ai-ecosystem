import {
  DOE_WSE_POLICY_2001_SECTIONS,
  WSE_EVALUATION_AREAS,
  WsePerformanceRating,
} from '@infinite-ai/contracts';

import type { ComplianceFinding, WseInput } from '../types.js';

export function checkWse(input: WseInput): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  const recordedAreas = new Set(input.evaluationRecords.map((r) => r.area));

  // All seven evaluation areas defined in WSE Policy §5 must be present.
  for (const required of WSE_EVALUATION_AREAS) {
    if (!recordedAreas.has(required)) {
      findings.push({
        area: 'WSE_RATINGS',
        severity: 'VIOLATION',
        code: 'WSE_AREA_MISSING',
        description: `Evaluation area "${required}" is missing. The WSE Policy §5 defines exactly seven evaluation areas; all must be evaluated and rated in a Whole-School Evaluation report.`,
        basis: DOE_WSE_POLICY_2001_SECTIONS.evaluationAreas,
        context: required,
      });
    }
  }

  // Each rating must be 1-4 as defined in WSE Policy §6.
  for (const record of input.evaluationRecords) {
    const parsed = WsePerformanceRating.safeParse(record.rating);
    if (!parsed.success) {
      findings.push({
        area: 'WSE_RATINGS',
        severity: 'VIOLATION',
        code: 'WSE_INVALID_RATING',
        description: `Performance rating ${record.rating} for area "${record.area}" is invalid. The WSE Policy §6 defines a four-point scale: 1 (Not Achieved), 2 (Partially Achieved), 3 (Achieved), 4 (Outstanding). Only values 1–4 are permitted.`,
        basis: DOE_WSE_POLICY_2001_SECTIONS.performanceRatings,
        context: record.area,
      });
    }
  }

  return findings;
}
