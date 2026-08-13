import { EEA_1998_SECTIONS, SASA_1996_SECTIONS } from '@infinite-ai/contracts';

import type { ComplianceFinding, ConductInput } from '../types.js';

export function checkConduct(input: ConductInput): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  // SASA §10 (strengthened by BELA Act 32/2024): corporal punishment is prohibited and
  // constitutes an offence. No record in the system may classify it as permitted.
  if (input.corporalPunishmentRecordedAsPermitted) {
    findings.push({
      area: 'CONDUCT',
      severity: 'VIOLATION',
      code: 'CORPORAL_PUNISHMENT_RECORDED_AS_PERMITTED',
      description:
        'Corporal punishment is recorded as permitted. SASA §10 (as amended by BELA Act 32/2024) explicitly prohibits corporal punishment and creates a criminal offence. This record must be corrected immediately.',
      basis: SASA_1996_SECTIONS.corporalPunishmentProhibition,
    });
  }

  // EEA §17: serious misconduct requires a formal charge sheet and the opportunity for the
  // educator to respond before any sanction is imposed.
  for (const record of input.disciplinaryRecords) {
    if (!record.hasChargeSheet) {
      findings.push({
        area: 'CONDUCT',
        severity: 'VIOLATION',
        code: 'MISSING_CHARGE_SHEET',
        description:
          'A disciplinary record exists with no formal charge sheet. EEA §17 requires a charge sheet before any serious misconduct hearing can proceed.',
        basis: EEA_1998_SECTIONS.seriousMisconduct,
        context: record.educatorToken,
      });
    }

    if (!record.hasResponseOpportunity) {
      findings.push({
        area: 'CONDUCT',
        severity: 'VIOLATION',
        code: 'NO_RESPONSE_OPPORTUNITY',
        description:
          'A disciplinary record exists where the educator was not given an opportunity to respond. EEA §17 requires that the educator be given a reasonable opportunity to state a case before a sanction is imposed.',
        basis: EEA_1998_SECTIONS.seriousMisconduct,
        context: record.educatorToken,
      });
    }
  }

  return findings;
}
