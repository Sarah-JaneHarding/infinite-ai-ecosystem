// Accessibility check contract — Stage 11 step 4.
//
// TB-07 (Accessibility Adapter) adapts classroom artefacts for learners with
// accessibility needs. The build manual requires "real accessibility validation
// (contrast, font size, line length, plain-language metrics)" rather than an
// honour-system claim that adaptation occurred.
//
// Each AccessibilityMode defines a named set of checks; every adapted artefact is
// validated against the checks for its mode before the result is returned. A failing
// check produces status 'accessibility_check_failed', mirroring the way
// 'readability_out_of_band' works in TB-03.
//
// Note on contrast: contrast is a rendering-layer concern (CSS / print stylesheet).
// TB-07 outputs text and layout specs, not rendered pixels; the contract checks for
// the presence of contrast-compliant colour directives in the output rather than a
// computed contrast ratio.

import { z } from 'zod';

/** The four accessibility adaptation modes supported by TB-07. */
export const AccessibilityMode = z.enum([
  'LARGE_PRINT',
  'DYSLEXIA_FRIENDLY',
  'SIMPLIFIED_LANGUAGE',
  'BRAILLE_READY',
]);
export type AccessibilityMode = z.infer<typeof AccessibilityMode>;

/**
 * One named check within an accessibility audit.
 *
 * Each mode defines its own check names; callers must not assume a fixed set.
 * Representative check names per mode:
 * - LARGE_PRINT: 'font_size_spec', 'line_length', 'single_column', 'contrast'
 * - DYSLEXIA_FRIENDLY: 'font_spec', 'line_spacing', 'line_length', 'left_align_only', 'no_italics'
 * - SIMPLIFIED_LANGUAGE: 'avg_sentence_length', 'technical_terms_addressed', 'readability_within_band'
 * - BRAILLE_READY: 'no_colour_only_references', 'no_image_only_content', 'linear_layout', 'math_linear_notation'
 */
export const AccessibilityCheckItem = z.object({
  /** Identifier for the check, e.g. 'font_size_spec'. */
  name: z.string().min(1),
  /** Human-readable statement of the requirement, e.g. "font size ≥ 18pt specified". */
  required: z.string().min(1),
  /** Human-readable description of what was found in the adapted output. */
  measured: z.string().min(1),
  pass: z.boolean(),
});
export type AccessibilityCheckItem = z.infer<typeof AccessibilityCheckItem>;

/**
 * Aggregated result of validating an adapted artefact against its mode's requirements.
 * Mirrors ReadabilityCheckResult in structure and intent.
 */
export const AccessibilityCheckResult = z.object({
  mode: AccessibilityMode,
  /** At least one check per mode. verdict is 'pass' only when every check passes. */
  checks: z.array(AccessibilityCheckItem).min(1),
  verdict: z.enum(['pass', 'fail']),
});
export type AccessibilityCheckResult = z.infer<typeof AccessibilityCheckResult>;
