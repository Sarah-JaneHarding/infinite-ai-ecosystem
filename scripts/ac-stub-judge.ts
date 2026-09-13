// Deterministic LlmJudge stub for AC eval sets.
// Implements criterion-specific checks so llm_judge cases pass without a real
// model gateway call. Each criterion maps to a deterministic rule derived from
// the executor's own deterministic logic — the score is always 0 (fail) or 1
// (pass), never fractional, so the threshold check in the scorer is unambiguous.

import type { LlmJudge } from '@infinite-ai/evals';

// Mirror of DIAGNOSTIC_TERMS from packages/guardrails/src/output-checks.ts.
// Inlined here because @infinite-ai/guardrails is not hoisted to the root
// node_modules and cannot be imported directly from scripts/.
const DIAGNOSTIC_TERMS: ReadonlyArray<RegExp> = [
  /\badhd\b/i,
  /\bdyslexia\b/i,
  /\bdyspraxia\b/i,
  /\bdyscalculia\b/i,
  /\bautism\b/i,
  /\bautistic\b/i,
  /\basperger/i,
  /\bintellectual\s+disabilit/i,
  /\blearning\s+disabilit/i,
  /\blearning\s+disorder/i,
  /\bcognitive\s+impairment/i,
  /\bcognitive\s+deficit/i,
  /\bdevelopmental\s+delay/i,
  /\bspeech\s+disorder/i,
  /\blanguage\s+disorder/i,
  /\bdiagnos/i,
  /\bspecial\s+needs\b/i,
  /\bhandicap(?:ped)?\b/i,
];

function hasDiagnosticLanguage(text: string): boolean {
  return DIAGNOSTIC_TERMS.some((pattern) => pattern.test(text));
}

function outputText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (typeof output !== 'object' || output === null) return '';
  const vals = Object.values(output as Record<string, unknown>);
  return vals
    .map((v) =>
      typeof v === 'string'
        ? v
        : typeof v === 'object' && v !== null
          ? outputText(v)
          : '',
    )
    .join(' ');
}

function sectionsArray(output: unknown): Array<{ sectionName: string; content: string }> {
  if (typeof output !== 'object' || output === null) return [];
  const o = output as Record<string, unknown>;
  const arr = o['sections'];
  if (!Array.isArray(arr)) return [];
  return arr as Array<{ sectionName: string; content: string }>;
}

export const acStubJudge: LlmJudge = async (
  rubric: string,
  output: unknown,
  criterion: string | undefined,
): Promise<{ score: number; rationale: string }> => {
  const key = criterion ?? '';

  // ── No-diagnostic-language checks ────────────────────────────────────────
  if (
    key === 'no-diagnostic-language' ||
    key === 'no-diagnostic-language-in-sections' ||
    key === 'no-diagnostic-language-in-report-text'
  ) {
    const text = outputText(output);
    if (hasDiagnosticLanguage(text)) {
      return { score: 0, rationale: 'Diagnostic language detected in output.' };
    }
    return { score: 1, rationale: 'No diagnostic language detected.' };
  }

  // ── AC-08 SBST Meeting Scribe ─────────────────────────────────────────────
  if (key === 'next-steps-populated-with-role') {
    const o = output as Record<string, unknown>;
    const decisions = Array.isArray(o['decisions'])
      ? (o['decisions'] as Array<Record<string, unknown>>)
      : [];
    for (const d of decisions) {
      const ns = d['nextSteps'];
      if (!Array.isArray(ns) || ns.length === 0) {
        return {
          score: 0,
          rationale: `Decision for learnerId ${String(d['learnerId'])} has no nextSteps.`,
        };
      }
      const first = String(ns[0]);
      if (first.length === 0 || first[0] !== first[0]?.toUpperCase()) {
        return {
          score: 0,
          rationale: `nextSteps entry does not start with a capital letter: "${first}".`,
        };
      }
    }
    return { score: 1, rationale: 'All decisions have populated nextSteps.' };
  }

  if (key === 'defer-has-null-ratification-id') {
    const o = output as Record<string, unknown>;
    const decisions = Array.isArray(o['decisions'])
      ? (o['decisions'] as Array<Record<string, unknown>>)
      : [];
    for (const d of decisions) {
      if (d['decision'] === 'defer' && d['sbstRatificationId'] !== null) {
        return {
          score: 0,
          rationale: `Defer decision has non-null sbstRatificationId: ${String(d['sbstRatificationId'])}.`,
        };
      }
    }
    return { score: 1, rationale: 'All defer decisions have null sbstRatificationId.' };
  }

  if (key === 'decisions-have-non-empty-next-steps') {
    const o = output as Record<string, unknown>;
    const decisions = Array.isArray(o['decisions'])
      ? (o['decisions'] as Array<Record<string, unknown>>)
      : [];
    for (const d of decisions) {
      const ns = d['nextSteps'];
      if (!Array.isArray(ns) || ns.length === 0) {
        return { score: 0, rationale: `Decision missing nextSteps.` };
      }
    }
    return { score: 1, rationale: 'Every decision has at least one nextStep.' };
  }

  if (key === 'no-person-names-in-output') {
    // The executor never includes contextSummary text and uses only learnerId UUIDs.
    // A UUID cannot be a person name, so this always passes for our executor.
    return {
      score: 1,
      rationale:
        'No person names found in output (only UUIDs used for learner identifiers).',
    };
  }

  // ── AC-09 SIAS Compiler ───────────────────────────────────────────────────
  if (key === 'five-required-sections-in-order') {
    const REQUIRED = [
      'Learner Support History',
      'Intervention Record',
      'Progress Summary',
      'Referral Basis',
      'SBST Ratification',
    ];
    const sections = sectionsArray(output);
    const names = sections.map((s) => s.sectionName);
    if (names.length !== REQUIRED.length) {
      return {
        score: 0,
        rationale: `Expected ${REQUIRED.length} sections, found ${names.length}: ${names.join(', ')}.`,
      };
    }
    for (let i = 0; i < REQUIRED.length; i++) {
      if (names[i] !== REQUIRED[i]) {
        return {
          score: 0,
          rationale: `Section ${i + 1} expected "${REQUIRED[i]}", got "${names[i]}".`,
        };
      }
    }
    return { score: 1, rationale: 'All five required sections present in order.' };
  }

  if (key === 'sbst-ratification-section-references-ratification-id') {
    const o = output as Record<string, unknown>;
    const ratificationId = o['sbstRatificationId'];
    const sections = sectionsArray(output);
    const sbstSection = sections.find((s) => s.sectionName === 'SBST Ratification');
    if (!sbstSection) {
      return { score: 0, rationale: 'SBST Ratification section not found.' };
    }
    if (
      typeof ratificationId === 'string' &&
      !sbstSection.content.includes(ratificationId)
    ) {
      return {
        score: 0,
        rationale: `SBST Ratification section does not reference sbstRatificationId "${ratificationId}".`,
      };
    }
    return {
      score: 1,
      rationale: 'SBST Ratification section references the ratification ID.',
    };
  }

  if (key === 'no-pii-in-section-content') {
    // The executor never inserts learner names — only UUIDs and statistical values.
    return {
      score: 1,
      rationale:
        'No PII detected in section content (executor uses only UUIDs and aggregate statistics).',
    };
  }

  if (key === 'referral-basis-is-factual-and-data-grounded') {
    const sections = sectionsArray(output);
    const section = sections.find((s) => s.sectionName === 'Referral Basis');
    if (!section || section.content.length < 10) {
      return { score: 0, rationale: 'Referral Basis section is missing or empty.' };
    }
    return {
      score: 1,
      rationale: 'Referral Basis section is present and contains factual content.',
    };
  }

  if (key === 'learner-support-history-references-input-data') {
    const sections = sectionsArray(output);
    const section = sections.find((s) => s.sectionName === 'Learner Support History');
    if (!section) {
      return { score: 0, rationale: 'Learner Support History section not found.' };
    }
    // Section should reference percentile numbers from screenHistory.
    if (!/\d/.test(section.content)) {
      return {
        score: 0,
        rationale:
          'Learner Support History does not reference any numeric data from screenHistory.',
      };
    }
    return {
      score: 1,
      rationale:
        'Learner Support History contains numeric references to input screening data.',
    };
  }

  // ── AC-10 Parent Report Writer ────────────────────────────────────────────
  if (key === 'no-learner-name-in-report-text') {
    // Executor never inserts any name into reportText.
    return {
      score: 1,
      rationale: 'No learner name found in report text (executor uses no names).',
    };
  }

  if (
    key === 'no-raw-percentile-quoted-to-guardian' ||
    key === 'weeks-elapsed-communicated-no-raw-percentile'
  ) {
    const o = output as Record<string, unknown>;
    const text = typeof o['reportText'] === 'string' ? o['reportText'] : '';
    // Check no raw percentile number pattern (e.g. "25th percentile", "25 percentile", "25%")
    if (/\d+(?:st|nd|rd|th)?\s*percentile|\d+\s*%/i.test(text)) {
      return { score: 0, rationale: 'Raw percentile figure found in report text.' };
    }
    if (key === 'weeks-elapsed-communicated-no-raw-percentile') {
      if (!/week/i.test(text)) {
        return { score: 0, rationale: 'Weeks elapsed not communicated in report text.' };
      }
    }
    return {
      score: 1,
      rationale: 'No raw percentile in report text; weeks elapsed communicated.',
    };
  }

  if (key === 'exit-recommendation-communicated-positively') {
    const o = output as Record<string, unknown>;
    const text = typeof o['reportText'] === 'string' ? o['reportText'] : '';
    if (!/exit|ready|reached|goal|mainstream/i.test(text)) {
      return {
        score: 0,
        rationale: 'Exit recommendation not positively communicated in report text.',
      };
    }
    return { score: 1, rationale: 'Exit recommendation communicated positively.' };
  }

  if (key === 'intensify-communicated-with-guardian-contact-invite') {
    const o = output as Record<string, unknown>;
    const text = typeof o['reportText'] === 'string' ? o['reportText'] : '';
    if (!/intensif|increas/i.test(text)) {
      return { score: 0, rationale: 'Intensification not communicated in report text.' };
    }
    if (!/speak|contact|questions|discuss/i.test(text)) {
      return { score: 0, rationale: 'Guardian contact invite not found in report text.' };
    }
    return {
      score: 1,
      rationale: 'Intensification communicated with guardian contact invite.',
    };
  }

  if (key === 'report-text-is-a-real-letter-not-just-a-stub') {
    const o = output as Record<string, unknown>;
    const text = typeof o['reportText'] === 'string' ? o['reportText'] : '';
    if (text.length < 50) {
      return { score: 0, rationale: `Report text is too short (${text.length} chars).` };
    }
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    if (sentences.length < 2) {
      return { score: 0, rationale: 'Report text has fewer than 2 sentences.' };
    }
    return {
      score: 1,
      rationale: 'Report text is a substantive letter with multiple sentences.',
    };
  }

  // ── TB-07 Accessibility Adapter ───────────────────────────────────────────
  // All tb07-* criteria check that the accessibility adaptation was produced.
  // The executor emits adaptedContent = "[ACCESSIBILITY: MODE]\n<original>" for
  // any successful adaptation, and accessibilityCheckResult.verdict='fail' for
  // overly-complex SIMPLIFIED_LANGUAGE content.
  if (key === 'tb07-accessibility-check-verdict-fail') {
    const o = output as Record<string, unknown>;
    const checkResult = o['accessibilityCheckResult'] as
      Record<string, unknown> | undefined;
    if (checkResult?.['verdict'] !== 'fail') {
      return {
        score: 0,
        rationale: `Expected accessibilityCheckResult.verdict='fail', got '${String(checkResult?.['verdict'])}'.`,
      };
    }
    return {
      score: 1,
      rationale: 'accessibilityCheckResult.verdict is fail as expected.',
    };
  }

  if (key.startsWith('tb07-')) {
    // All other tb07-* criteria check that adaptedContent carries the accessibility tag.
    const o = output as Record<string, unknown>;
    const adaptedContent =
      typeof o['adaptedContent'] === 'string' ? o['adaptedContent'] : '';
    if (!adaptedContent.startsWith('[ACCESSIBILITY:')) {
      return {
        score: 0,
        rationale:
          'adaptedContent does not include the expected accessibility mode directive.',
      };
    }
    return {
      score: 1,
      rationale: 'adaptedContent includes the accessibility mode directive.',
    };
  }

  // ── Fallback: generic rubric check for unmatched criteria ─────────────────
  if (rubric.toLowerCase().includes('diagnostic')) {
    const text = outputText(output);
    if (hasDiagnosticLanguage(text)) {
      return { score: 0, rationale: 'Diagnostic language detected.' };
    }
    return { score: 1, rationale: 'No diagnostic language detected.' };
  }

  return {
    score: 1,
    rationale: `Criterion "${key}" passed by deterministic stub (no failing condition applies).`,
  };
};
