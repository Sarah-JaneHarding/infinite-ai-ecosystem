// Template fidelity's first real checker — Stage 08 step 1.

import { describe, expect, it } from 'vitest';

import type { ArtefactStructure, TemplateDefinition } from '@infinite-ai/contracts';

import { checkTemplateFidelity } from '../src/output-checks.js';
import { buildTemplateFidelityChecker } from '../src/template-fidelity.js';

const source = {
  documentId: 'school-lesson-plan-template',
  documentVersion: '2026-term1',
  clause: 'as supplied',
  ratifiedBy: 'hod-1',
};

const ratifiedDefinition: TemplateDefinition = {
  artefactType: 'LESSON_PLAN',
  version: '1.0.0',
  source,
  sections: [
    {
      name: 'Header',
      order: 0,
      required: true,
      fields: [{ name: 'Date', required: true }],
    },
    {
      name: 'Body',
      order: 1,
      required: true,
      fields: [{ name: 'Activities', required: true }],
    },
  ],
  ratifiedAt: '2026-05-01T00:00:00.000Z',
};

interface FakeArtefact {
  readonly sections: ReadonlyArray<{
    readonly name: string;
    readonly fields: readonly string[];
  }>;
}

const extractStructure = (output: unknown): ArtefactStructure => output as FakeArtefact;

describe('buildTemplateFidelityChecker', () => {
  it('passes a rendered artefact that matches the ratified definition', () => {
    const checker = buildTemplateFidelityChecker(ratifiedDefinition, extractStructure);
    const verdict = checker({
      sections: [
        { name: 'Header', fields: ['Date'] },
        { name: 'Body', fields: ['Activities'] },
      ],
    });
    expect(verdict.passed).toBe(true);
  });

  it('refuses with template_infidelity and names the violation', () => {
    const checker = buildTemplateFidelityChecker(ratifiedDefinition, extractStructure);
    const verdict = checker({ sections: [{ name: 'Header', fields: ['Date'] }] });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.refusal.code).toBe('template_infidelity');
      expect(verdict.refusal.explanation).toContain('Body');
    }
  });

  it('refuses outright against an unratified definition, before checking structure', () => {
    const draft: TemplateDefinition = { ...ratifiedDefinition, ratifiedAt: null };
    const checker = buildTemplateFidelityChecker(draft, extractStructure);
    const verdict = checker({
      sections: [
        { name: 'Header', fields: ['Date'] },
        { name: 'Body', fields: ['Activities'] },
      ],
    });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.refusal.code).toBe('template_infidelity');
      expect(verdict.refusal.explanation).toContain('not yet ratified');
    }
  });

  it('describes every violation kind in the refusal explanation', () => {
    const checker = buildTemplateFidelityChecker(ratifiedDefinition, extractStructure);
    const verdict = checker({
      sections: [
        { name: 'Body', fields: ['Activities'] },
        { name: 'Header', fields: [] },
        { name: 'Homework', fields: ['Task'] },
      ],
    });
    expect(verdict.passed).toBe(false);
    if (!verdict.passed) {
      expect(verdict.refusal.explanation).toContain('unexpected section "Homework"');
      expect(verdict.refusal.explanation).toContain('sections out of order');
      expect(verdict.refusal.explanation).toContain(
        'section "Header" is missing required field "Date"',
      );
    }
  });

  it('wires into checkTemplateFidelity the same way any injected checker does', () => {
    const checker = buildTemplateFidelityChecker(ratifiedDefinition, extractStructure);
    const verdict = checkTemplateFidelity(
      { sections: [{ name: 'Header', fields: ['Date'] }] },
      checker,
    );
    expect(verdict.passed).toBe(false);
  });
});
