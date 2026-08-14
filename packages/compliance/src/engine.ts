import { checkAttendance } from './checks/attendance.js';
import { checkConduct } from './checks/conduct.js';
import { checkFees } from './checks/fees.js';
import { checkPdPoints } from './checks/pd-points.js';
import { checkSias } from './checks/sias.js';
import { checkWse } from './checks/wse.js';
import type { ComplianceFinding, ComplianceInput, ComplianceReport } from './types.js';

/** Run all declared compliance checks and aggregate the results into a report.
 *
 *  Each check is optional — pass only the inputs you have data for.
 *  Findings are returned in the order the checks run; callers should sort by severity
 *  if they need VIOLATION before WARNING before INFO.
 */
export function runComplianceChecks(
  input: ComplianceInput,
  now: string = new Date().toISOString(),
): ComplianceReport {
  const findings: ComplianceFinding[] = [];

  if (input.attendance !== undefined) {
    findings.push(...checkAttendance(input.attendance));
  }

  if (input.fees !== undefined) {
    findings.push(...checkFees(input.fees));
  }

  if (input.conduct !== undefined) {
    findings.push(...checkConduct(input.conduct));
  }

  if (input.sias !== undefined) {
    findings.push(...checkSias(input.sias));
  }

  if (input.pdPoints !== undefined) {
    findings.push(...checkPdPoints(input.pdPoints));
  }

  if (input.wse !== undefined) {
    findings.push(...checkWse(input.wse));
  }

  return {
    tenantId: input.tenantId,
    generatedAt: now,
    findings,
    summary: {
      violations: findings.filter((f) => f.severity === 'VIOLATION').length,
      warnings: findings.filter((f) => f.severity === 'WARNING').length,
      infos: findings.filter((f) => f.severity === 'INFO').length,
    },
  };
}
