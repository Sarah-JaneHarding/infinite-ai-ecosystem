import { SchoolConfig } from './types.js';
import type { LanguageSettings, TermWeeks } from './types.js';

/** Returns periods per week (each period = 30 min; 2 periods per hour). */
export function periodsFromHours(hoursPerWeek: number): number {
  return Math.round(hoursPerWeek * 2);
}

/** Total teaching weeks across all four terms. */
export function totalWeeks(termWeeks: TermWeeks): number {
  return termWeeks.term1 + termWeeks.term2 + termWeeks.term3 + termWeeks.term4;
}

/**
 * Checks that no language appears in more than one role.
 * Returns a human-readable error string, or null when clean.
 */
export function validateLanguageConflicts(settings: LanguageSettings): string | null {
  const fal = settings.fal;
  const sal = settings.sal ?? [];

  if (fal.includes(settings.lolt)) {
    return `${settings.lolt} cannot be both LOLT and FAL`;
  }
  if (sal.includes(settings.lolt)) {
    return `${settings.lolt} cannot be both LOLT and SAL`;
  }
  const overlap = fal.filter((l) => sal.includes(l));
  if (overlap.length > 0) {
    return `${overlap.join(', ')} cannot appear in both FAL and SAL`;
  }
  return null;
}

/** Parse and validate a raw unknown value as SchoolConfig; throws ZodError on failure. */
export function validateSchoolConfig(raw: unknown): SchoolConfig {
  return SchoolConfig.parse(raw);
}
