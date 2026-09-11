// packages/contracts/src/curriculum/subject-mapper.ts
//
// Maps free-text CAPS subject names to the canonical DbeSubjectCategory enum.
// Pure, deterministic lookup — no LLM involvement. An unmappable name returns
// null so the caller emits needs_input rather than guessing.

import type { DbeSubjectCategory } from './dbe-allocations.js';

type MappingRule = {
  readonly pattern: RegExp;
  readonly category: DbeSubjectCategory;
};

const MAPPING_RULES: readonly MappingRule[] = [
  {
    pattern: /natural\s+sciences?\s+(?:and|&)\s+tech/i,
    category: 'NATURAL_SCIENCES_AND_TECHNOLOGY',
  },
  { pattern: /\bNST\b/, category: 'NATURAL_SCIENCES_AND_TECHNOLOGY' },
  { pattern: /natural\s+sciences?/i, category: 'NATURAL_SCIENCES' },
  { pattern: /\btechnology\b/i, category: 'TECHNOLOGY' },
  { pattern: /home\s+lang/i, category: 'HOME_LANGUAGE' },
  { pattern: /\bHL\b/, category: 'HOME_LANGUAGE' },
  { pattern: /first\s+additional\s+lang/i, category: 'FIRST_ADDITIONAL_LANGUAGE' },
  { pattern: /\bFAL\b/, category: 'FIRST_ADDITIONAL_LANGUAGE' },
  { pattern: /math/i, category: 'MATHEMATICS' },
  { pattern: /social\s+sciences?/i, category: 'SOCIAL_SCIENCES' },
  { pattern: /life\s+orientation/i, category: 'LIFE_ORIENTATION' },
  { pattern: /\bLO\b/, category: 'LIFE_ORIENTATION' },
  { pattern: /life\s+skills?/i, category: 'LIFE_SKILLS' },
  {
    pattern: /economic.*management|\bEMS\b/i,
    category: 'ECONOMIC_AND_MANAGEMENT_SCIENCES',
  },
  { pattern: /creative\s+arts?/i, category: 'CREATIVE_ARTS' },
];

export function mapSubjectToCategory(name: string): DbeSubjectCategory | null {
  const trimmed = name.trim();
  if (!trimmed) return null;

  for (const rule of MAPPING_RULES) {
    if (rule.pattern.test(trimmed)) {
      return rule.category;
    }
  }

  return null;
}
