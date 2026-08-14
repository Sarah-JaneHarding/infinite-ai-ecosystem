// @infinite-ai/compliance — Policy Compliance Engine.
//
// Pure synchronous functions: school operation data in, typed compliance findings out.
// Every finding cites the specific source document and clause that creates the obligation —
// no invented rules; if a rule has no SourceRef, it does not belong here.

export { checkAttendance } from './checks/attendance.js';
export { checkConduct } from './checks/conduct.js';
export { checkFees } from './checks/fees.js';
export { checkPdPoints } from './checks/pd-points.js';
export { checkSias } from './checks/sias.js';
export { checkWse } from './checks/wse.js';
export { runComplianceChecks } from './engine.js';
// Zod schemas (runtime values that also serve as types via z.infer)
export {
  AttendanceInput,
  ComplianceInput,
  ConductInput,
  FeesInput,
  PdPointsInput,
  SiasInput,
  WseInput,
} from './types.js';
// Pure type aliases / interfaces (no runtime representation)
export type {
  ComplianceArea,
  ComplianceFinding,
  ComplianceReport,
  ComplianceSeverity,
} from './types.js';
