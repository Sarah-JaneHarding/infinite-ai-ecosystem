// DW-06 Learner-360 Builder — Stage 09 step 6.
//
// Deterministic, model-free materialisation of a learner's cross-domain profile
// for one academic term.  All persistence is injected via Learner360Store so the
// unit tier runs without Postgres; the production runtime supplies the real
// implementation backed by the conformed event log.
//
// Two outcomes via DW06Result:
//   ok          — profile built (domain summaries are null when no events exist for that domain)
//   needs_input — no events found for this learner/term; cannot materialise a profile

import type { DW06Input } from '../agent-inputs.js';
import type { DW06Result } from '../types.js';
import type {
  AcademicSummary,
  AttendanceSummary,
  BehaviourSummary,
  DataDomain,
  Learner360Profile,
  WellbeingSummary,
} from '../types.js';

// ---------------------------------------------------------------------------
// Store interface (injected; no direct DB import)
// ---------------------------------------------------------------------------

/** A single conformed event as loaded from the domain_event_log. */
export interface Learner360Event {
  readonly domain: DataDomain;
  readonly eventType: string;
  readonly occurredAt: string;
  readonly payload?: Readonly<Record<string, unknown>>;
  /**
   * Set to true by the quality gate when this event's source run was
   * below the blocking threshold.  Events with this flag are excluded
   * from summary calculations; their presence sets dataQualityNote.
   */
  readonly blockedDownstream?: boolean;
}

/**
 * Persistence boundary for DW-06.  The production adapter queries the
 * `domain_event_log` table through the tenant-scoped Prisma client.
 */
export interface Learner360Store {
  loadEvents(
    tenantId: string,
    learnerId: string,
    termNumber: number,
    academicYear: number,
  ): Promise<readonly Learner360Event[]>;
}

// ---------------------------------------------------------------------------
// Domain-specific accumulators (pure helpers, not exported)
// ---------------------------------------------------------------------------

function buildAttendanceSummary(
  events: readonly Learner360Event[],
  termNumber: number,
  academicYear: number,
): AttendanceSummary | null {
  const relevant = events.filter(
    (e) => e.domain === 'ATTENDANCE' && !e.blockedDownstream,
  );
  if (relevant.length === 0) return null;

  let presentDays = 0;
  let absentDays = 0;
  let lateDays = 0;

  for (const e of relevant) {
    if (e.eventType === 'attendance.present') presentDays++;
    else if (e.eventType === 'attendance.absent') absentDays++;
    else if (e.eventType === 'attendance.late') lateDays++;
  }

  const totalDays = presentDays + absentDays + lateDays;
  const attendanceRatePct =
    totalDays > 0 ? Math.round((100 * presentDays) / totalDays) : 0;

  return {
    termNumber,
    academicYear,
    presentDays,
    absentDays,
    lateDays,
    attendanceRatePct,
  };
}

function buildAcademicSummary(
  events: readonly Learner360Event[],
  termNumber: number,
  academicYear: number,
): AcademicSummary | null {
  const relevant = events.filter(
    (e) =>
      e.domain === 'ASSESSMENT' &&
      e.eventType === 'assessment.score' &&
      !e.blockedDownstream,
  );
  if (relevant.length === 0) return null;

  // Latest score wins when a subject appears more than once.
  const subjectBuckets = new Map<string, number[]>();
  for (const e of relevant) {
    const code = String(e.payload?.['subjectCode'] ?? 'UNKNOWN');
    const score = Number(e.payload?.['scorePercent'] ?? 0);
    const bucket = subjectBuckets.get(code);
    if (bucket === undefined) {
      subjectBuckets.set(code, [score]);
    } else {
      bucket.push(score);
    }
  }

  const subjectAverages: Record<string, number> = {};
  for (const [code, bucket] of subjectBuckets) {
    subjectAverages[code] = Math.round(bucket.reduce((s, v) => s + v, 0) / bucket.length);
  }

  const scores = Object.values(subjectAverages);
  const overallAverage =
    scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  return { termNumber, academicYear, subjectAverages, overallAverage };
}

function buildBehaviourSummary(
  events: readonly Learner360Event[],
  termNumber: number,
  academicYear: number,
): BehaviourSummary | null {
  const relevant = events.filter((e) => e.domain === 'BEHAVIOUR' && !e.blockedDownstream);
  if (relevant.length === 0) return null;

  const incidentCount = relevant.length;

  // Most recent by occurredAt string comparison (ISO dates sort lexicographically)
  const mostRecent = [...relevant].sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  )[0];
  const mostRecentKind =
    mostRecent?.payload?.['behaviourKind'] !== undefined
      ? String(mostRecent.payload['behaviourKind'])
      : undefined;

  return { termNumber, academicYear, incidentCount, mostRecentKind };
}

function buildWellbeingSummary(
  events: readonly Learner360Event[],
  termNumber: number,
  academicYear: number,
): WellbeingSummary | null {
  const relevant = events.filter(
    (e) =>
      e.domain === 'WELLBEING' &&
      e.eventType === 'wellbeing.screener' &&
      !e.blockedDownstream,
  );
  if (relevant.length === 0) return null;

  const screenerScores: Record<string, number> = {};
  let flagged = false;

  for (const e of relevant) {
    const kind = String(e.payload?.['screenerKind'] ?? 'UNKNOWN');
    const score = Number(e.payload?.['screenerScore'] ?? 0);
    const threshold = Number(e.payload?.['threshold'] ?? 0);
    screenerScores[kind] = score;
    if (score >= threshold) flagged = true;
  }

  return { termNumber, academicYear, screenerScores, flagged };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Materialises a Learner-360 profile from conformed events for one term.
 *
 * @param input  DW06 agent input.
 * @param store  Injected event store (no direct DB import).
 * @param now    ISO datetime used as lastMaterialisedAt. Inject in tests.
 */
export async function buildLearner360(
  input: DW06Input,
  store: Learner360Store,
  now: string = new Date().toISOString(),
): Promise<DW06Result> {
  const { tenantId, learnerId, termNumber, academicYear } = input;

  const events = await store.loadEvents(tenantId, learnerId, termNumber, academicYear);

  if (events.length === 0) {
    return {
      status: 'needs_input',
      learnerId,
      detail: `No conformed events found for learner ${learnerId} in term ${termNumber}/${academicYear}.`,
    };
  }

  const attendance = buildAttendanceSummary(events, termNumber, academicYear);
  const academic = buildAcademicSummary(events, termNumber, academicYear);
  const behaviour = buildBehaviourSummary(events, termNumber, academicYear);
  const wellbeing = buildWellbeingSummary(events, termNumber, academicYear);

  const hasBlockedDomain = events.some((e) => e.blockedDownstream === true);
  const dataQualityNote = hasBlockedDomain
    ? 'One or more source domains had data quality issues that prevented full materialisation. Summaries reflect only unblocked events.'
    : null;

  const profile: Learner360Profile = {
    learnerId,
    tenantId,
    attendance,
    academic,
    behaviour,
    wellbeing,
    screenerResults: null,
    dataQualityNote,
    lastMaterialisedAt: now,
  };

  return { status: 'ok', profile };
}
