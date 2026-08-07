// DW-05 Data Quality Sentinel — Stage 09 step 5.
//
// Pure, synchronous quality check over a batch of canonical records.
// No database imports: all quality rules are declared inline so the unit tier
// can drive the function without any infrastructure.
//
// Three outcomes via DW05Result:
//   ok           — checks ran; qualityScore, rejectedRecords, and issues are populated
//   needs_input  — sampleRecords is empty; human must supply data before checks can run
//
// Blocking: qualityScore < BLOCKING_THRESHOLD sets blockedDownstream = true.
// Records are "rejected" when they have at least one ERROR-severity issue;
// the score is 100 * (total − rejected) / total, clamped to [0, 100].

import type { DW05Input, DW05Result } from '../agent-inputs.js';
import type { DataDomain, QualityIssue } from '../types.js';

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const BLOCKING_THRESHOLD = 60;

// ---------------------------------------------------------------------------
// Domain rule definitions
// ---------------------------------------------------------------------------

interface NumericConstraint {
  /** Values strictly above this are IMPOSSIBLE (ERROR). */
  readonly impossibleAbove?: number;
  /** If true, negative values are IMPOSSIBLE (ERROR). */
  readonly nonNegative?: boolean;
}

interface FieldRule {
  /** Missing or empty value → MISSING_FIELD ERROR. */
  readonly required?: boolean;
  /** Value not in list → REFERENTIAL_INTEGRITY ERROR. */
  readonly allowedValues?: readonly string[];
  /** Applied when the field value is a number. */
  readonly numeric?: NumericConstraint;
  /** Date string (YYYY-MM-DD) after today → IMPOSSIBLE_VALUE WARNING. */
  readonly noFutureDate?: boolean;
}

interface DomainRules {
  readonly fieldRules: Readonly<Record<string, FieldRule>>;
  /** Fields combined into a deduplication key (exact match). */
  readonly duplicateKeyFields: readonly string[];
}

const ATTENDANCE_RULES: DomainRules = {
  fieldRules: {
    learnerToken: { required: true },
    attendanceStatus: {
      required: true,
      allowedValues: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'],
    },
    occurredAt: { required: true, noFutureDate: true },
    attendanceRatePct: { numeric: { impossibleAbove: 100, nonNegative: true } },
    absentDays: { numeric: { nonNegative: true } },
    presentDays: { numeric: { nonNegative: true } },
    lateDays: { numeric: { nonNegative: true } },
  },
  duplicateKeyFields: ['learnerToken', 'occurredAt'],
};

const ASSESSMENT_RULES: DomainRules = {
  fieldRules: {
    learnerToken: { required: true },
    scorePercent: {
      required: true,
      numeric: { impossibleAbove: 100, nonNegative: true },
    },
    occurredAt: { required: true, noFutureDate: true },
  },
  duplicateKeyFields: ['learnerToken', 'occurredAt', 'subjectCode'],
};

const BEHAVIOUR_RULES: DomainRules = {
  fieldRules: {
    learnerToken: { required: true },
    occurredAt: { required: true, noFutureDate: true },
  },
  duplicateKeyFields: ['learnerToken', 'occurredAt'],
};

const WELLBEING_RULES: DomainRules = {
  fieldRules: {
    learnerToken: { required: true },
    occurredAt: { required: true, noFutureDate: true },
  },
  duplicateKeyFields: ['learnerToken', 'occurredAt'],
};

const DEMOGRAPHIC_RULES: DomainRules = {
  fieldRules: {
    learnerToken: { required: true },
  },
  duplicateKeyFields: ['learnerToken'],
};

const SCREENER_RULES: DomainRules = {
  fieldRules: {
    learnerToken: { required: true },
    occurredAt: { required: true, noFutureDate: true },
  },
  duplicateKeyFields: ['learnerToken', 'occurredAt'],
};

function domainRules(domain: DataDomain): DomainRules {
  switch (domain) {
    case 'ATTENDANCE':
      return ATTENDANCE_RULES;
    case 'ASSESSMENT':
      return ASSESSMENT_RULES;
    case 'BEHAVIOUR':
      return BEHAVIOUR_RULES;
    case 'WELLBEING':
      return WELLBEING_RULES;
    case 'DEMOGRAPHIC':
      return DEMOGRAPHIC_RULES;
    case 'SCREENER':
      return SCREENER_RULES;
  }
}

// ---------------------------------------------------------------------------
// Per-record checks
// ---------------------------------------------------------------------------

function checkRecord(
  record: Readonly<Record<string, unknown>>,
  rules: DomainRules,
  seenKeys: Set<string>,
  today: string,
): readonly QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const [field, rule] of Object.entries(rules.fieldRules)) {
    const raw = record[field];
    const absent = raw === undefined || raw === null || raw === '';

    if (rule.required === true && absent) {
      issues.push({
        kind: 'MISSING_FIELD',
        field,
        detail: `Required field "${field}" is missing or empty.`,
        severity: 'ERROR',
      });
      continue;
    }

    if (absent) continue;

    if (rule.allowedValues !== undefined) {
      const str = String(raw);
      if (!rule.allowedValues.includes(str)) {
        issues.push({
          kind: 'REFERENTIAL_INTEGRITY',
          field,
          detail: `"${field}" value is not in the allowed set: ${rule.allowedValues.join(', ')}.`,
          severity: 'ERROR',
        });
      }
    }

    if (rule.numeric !== undefined && typeof raw === 'number') {
      const n = raw;
      if (rule.numeric.nonNegative === true && n < 0) {
        issues.push({
          kind: 'IMPOSSIBLE_VALUE',
          field,
          detail: `"${field}" cannot be negative (got ${n}).`,
          severity: 'ERROR',
        });
      } else if (
        rule.numeric.impossibleAbove !== undefined &&
        n > rule.numeric.impossibleAbove
      ) {
        issues.push({
          kind: 'IMPOSSIBLE_VALUE',
          field,
          detail: `"${field}" exceeds the maximum of ${rule.numeric.impossibleAbove} (got ${n}).`,
          severity: 'ERROR',
        });
      }
    }

    if (rule.noFutureDate === true && typeof raw === 'string' && raw > today) {
      issues.push({
        kind: 'IMPOSSIBLE_VALUE',
        field,
        detail: `"${field}" is in the future (got ${raw}).`,
        severity: 'WARNING',
      });
    }
  }

  // Duplicate detection (exact match on key fields)
  const keyParts = rules.duplicateKeyFields.map((f) => String(record[f] ?? ''));
  const key = keyParts.join('\x00');
  if (seenKeys.has(key)) {
    issues.push({
      kind: 'DUPLICATE_RECORD',
      detail: `Duplicate record detected on key fields: ${rules.duplicateKeyFields.join(', ')}.`,
      severity: 'WARNING',
    });
  } else {
    seenKeys.add(key);
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Runs quality checks over a batch of canonical records.
 *
 * @param input   DW05 agent input (tenantId, runId, domain, sampleRecords).
 * @param asOf    ISO date string used as "today" for future-date checks.
 *                Defaults to the current UTC date. Inject a fixed value in tests.
 */
export function runQualityChecks(
  input: DW05Input,
  asOf: string = new Date().toISOString().slice(0, 10),
): DW05Result {
  const { sampleRecords, domain } = input;

  if (sampleRecords.length === 0) {
    return {
      status: 'needs_input',
      detail: 'No records provided; cannot run quality checks on an empty batch.',
    };
  }

  const rules = domainRules(domain);
  const seenKeys = new Set<string>();
  const allIssues: QualityIssue[] = [];
  let rejectedCount = 0;

  for (const record of sampleRecords) {
    const recordIssues = checkRecord(record, rules, seenKeys, asOf);
    const hasError = recordIssues.some((i) => i.severity === 'ERROR');
    if (hasError) rejectedCount += 1;
    allIssues.push(...recordIssues);
  }

  const totalRecords = sampleRecords.length;
  const qualityScore = Math.round((100 * (totalRecords - rejectedCount)) / totalRecords);
  const blockedDownstream = qualityScore < BLOCKING_THRESHOLD;

  return {
    status: 'ok',
    qualityScore,
    blockedDownstream,
    totalRecords,
    rejectedRecords: rejectedCount,
    issues: allIssues,
  };
}
