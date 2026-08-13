// Tenant context — Stage 21 (System Prompt Builder).
//
// Every agent invocation runs within a school's context. The fields here are
// injected into the system prompt header at request time — they tell the model
// which school it is serving, what locale to use, and which policy constraints
// the school has configured. None of these fields carry learner personal data;
// they describe the institutional context only.

import { z } from 'zod';

export const TenantPhase = z.enum([
  'foundation', // Grades R–3
  'intermediate', // Grades 4–6
  'senior', // Grades 7–9
  'fet', // Grades 10–12
]);
export type TenantPhase = z.infer<typeof TenantPhase>;

export const TenantContext = z.object({
  /** Unique tenant identifier — passed through to the gateway for budget attribution. */
  tenantId: z.string().min(1),
  /** School name as it should appear in any human-facing output. */
  schoolName: z.string().min(1),
  /** Primary locale for text generation (e.g. "en-ZA", "zu-ZA", "af-ZA"). */
  locale: z.string().min(2),
  /**
   * The school phases this tenant serves. Informs the model about the relevant
   * CAPS phase constraints without exposing learner data.
   */
  phases: z.array(TenantPhase).min(1),
  /** Two-letter province code (e.g. "GP", "WC", "KZN"). */
  province: z.string().min(2).max(3),
  /**
   * Whether this tenant has enabled the low-tech mode flag. When true the model
   * should prefer plain text and printable formats over rich-media outputs.
   */
  lowTechMode: z.boolean().default(false),
});
export type TenantContext = z.infer<typeof TenantContext>;
