import { DBE_SIAS_2014_SECTIONS } from '@infinite-ai/contracts';

import type { ComplianceFinding, SiasInput } from '../types.js';

/** The SIAS process has 6 stages (DBE SIAS 2014, Chapter 6). */
const SIAS_TOTAL_STAGES = 6;

export function checkSias(input: SiasInput): ComplianceFinding[] {
  const findings: ComplianceFinding[] = [];

  for (const referral of input.referrals) {
    // An active referral that has not progressed past stage 0 has never been formally
    // entered into the SIAS process.
    if (referral.active && referral.stageCompleted === 0) {
      findings.push({
        area: 'SIAS_PROCESS',
        severity: 'WARNING',
        code: 'SIAS_NOT_STARTED',
        description:
          'An active referral has not yet entered the SIAS process (stage completed: 0). DBE SIAS Policy 2014, Chapter 6, requires that a concern is formally screened at Stage 1 before any support plan is developed.',
        basis: DBE_SIAS_2014_SECTIONS.siasProcess,
        context: referral.referralId,
      });
    }

    // Documentation must be filed for every stage that has been completed.
    if (referral.stageCompleted > 0 && !referral.documentationComplete) {
      findings.push({
        area: 'SIAS_PROCESS',
        severity: 'VIOLATION',
        code: 'SIAS_DOCUMENTATION_INCOMPLETE',
        description: `SIAS referral has completed ${referral.stageCompleted} of ${SIAS_TOTAL_STAGES} stages but documentation is incomplete. DBE SIAS Policy 2014 requires that the SNA forms (SNA 1 from the teacher, SNA 2 from the SBST, SNA 3 from the DBST) are completed and filed at the applicable stages.`,
        basis: DBE_SIAS_2014_SECTIONS.snA1Form,
        context: referral.referralId,
      });
    }

    // An active referral that has cleared all 6 stages should have been resolved.
    if (referral.active && referral.stageCompleted >= SIAS_TOTAL_STAGES) {
      findings.push({
        area: 'SIAS_PROCESS',
        severity: 'INFO',
        code: 'SIAS_PROCESS_COMPLETE_BUT_ACTIVE',
        description: `SIAS referral has completed all ${SIAS_TOTAL_STAGES} stages but is still marked active. The SIAS process (Chapter 6) culminates in a placement decision at Stage 6; this referral should be resolved or re-opened with a new entry.`,
        basis: DBE_SIAS_2014_SECTIONS.siasProcess,
        context: referral.referralId,
      });
    }
  }

  return findings;
}
