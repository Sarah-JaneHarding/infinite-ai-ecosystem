// Template fidelity's first real checker — Stage 08 step 1.
//
// `output-checks.ts`'s `checkTemplateFidelity` has taken an injected `TemplateFidelityChecker`
// since Stage 06, defaulting to `PASSED` because no school template existed to check
// against (OQ-003). Stage 08's contracts package (`curriculum/template.ts`) now defines what
// a template *is* and a pure structural diff (`checkArtefactStructure`); this module is the
// adapter that turns that diff into the `(output: unknown) => GuardrailVerdict` shape the
// engine already calls. It reuses the existing `template_infidelity` reason code
// (`refusal.ts`) rather than inventing a new one — this is a first implementation of an
// already-named check, not a new kind of refusal.
//
// `extractStructure` is caller-supplied because this package cannot know how a given
// agent's own output schema encodes "sections" — that mapping belongs to whichever CE-0x
// agent owns the artefact type, the same "declare now, verify once the owner exists" shape
// `checkTemplateFidelity`'s own optional `checker` already uses one level up.

import {
  checkArtefactStructure,
  type ArtefactStructure,
  type TemplateDefinition,
  type TemplateFidelityViolation,
} from '@infinite-ai/contracts';

import { refuse, PASSED, type GuardrailVerdict } from './refusal.js';
import type { TemplateFidelityChecker } from './output-checks.js';

function describeViolation(violation: TemplateFidelityViolation): string {
  switch (violation.kind) {
    case 'missing_section':
      return `missing required section "${violation.section}"`;
    case 'unexpected_section':
      return `unexpected section "${violation.section}" not in the template definition`;
    case 'out_of_order':
      return (
        `sections out of order: expected [${violation.expected.join(', ')}], ` +
        `got [${violation.actual.join(', ')}]`
      );
    case 'missing_field':
      return `section "${violation.section}" is missing required field "${violation.field}"`;
  }
}

/**
 * Builds a `TemplateFidelityChecker` bound to one ratified `TemplateDefinition`. A
 * definition with `ratifiedAt: null` is refused outright: an unratified definition is not
 * yet policy, and rendering against draft structure would let an artefact "pass" a check
 * nobody has actually approved.
 */
export function buildTemplateFidelityChecker(
  definition: TemplateDefinition,
  extractStructure: (output: unknown) => ArtefactStructure,
): TemplateFidelityChecker {
  return (output: unknown): GuardrailVerdict => {
    if (definition.ratifiedAt === null) {
      return refuse(
        'template_infidelity',
        `Template definition for "${definition.artefactType}" is not yet ratified; ` +
          'no artefact may be checked against draft structure.',
      );
    }
    const structure = extractStructure(output);
    const violations = checkArtefactStructure(definition, structure);
    if (violations.length === 0) return PASSED;
    return refuse(
      'template_infidelity',
      `Artefact does not match the "${definition.artefactType}" template ` +
        `(v${definition.version}): ${violations.map(describeViolation).join('; ')}.`,
    );
  };
}
