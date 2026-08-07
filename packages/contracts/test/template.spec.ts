// The machine-readable template definition — Stage 08 step 1.
//
// These tests prove the schema's own structural rules (a dense, gap-free section order; no
// duplicate section names) and the fidelity check's four violation kinds independently, the
// same way framework.spec.ts proves SourceRef and TimeAllocation apart from GradeFramework.

import { describe, expect, it } from 'vitest';

import type { SourceRef } from '../src/curriculum/framework.js';
import {
  TemplateDefinition,
  checkArtefactStructure,
  type ArtefactStructure,
} from '../src/curriculum/template.js';

const source: SourceRef = {
  documentId: 'school-lesson-plan-template',
  documentVersion: '2026-term1',
  clause: 'as supplied',
  ratifiedBy: null,
};

function definitionWith(sections: Array<Record<string, unknown>>) {
  return {
    artefactType: 'LESSON_PLAN',
    version: '1.0.0',
    source,
    sections,
    ratifiedAt: null,
  };
}

describe('TemplateDefinition', () => {
  it('accepts a definition with sections in a dense 0..n-1 order', () => {
    const result = TemplateDefinition.safeParse(
      definitionWith([
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
      ]),
    );
    expect(result.success).toBe(true);
  });

  it('rejects an order with a gap', () => {
    const result = TemplateDefinition.safeParse(
      definitionWith([
        {
          name: 'Header',
          order: 0,
          required: true,
          fields: [{ name: 'Date', required: true }],
        },
        {
          name: 'Body',
          order: 2,
          required: true,
          fields: [{ name: 'Activities', required: true }],
        },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a repeated order value', () => {
    const result = TemplateDefinition.safeParse(
      definitionWith([
        {
          name: 'Header',
          order: 0,
          required: true,
          fields: [{ name: 'Date', required: true }],
        },
        {
          name: 'Body',
          order: 0,
          required: true,
          fields: [{ name: 'Activities', required: true }],
        },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a duplicate section name', () => {
    const result = TemplateDefinition.safeParse(
      definitionWith([
        {
          name: 'Header',
          order: 0,
          required: true,
          fields: [{ name: 'Date', required: true }],
        },
        {
          name: 'Header',
          order: 1,
          required: true,
          fields: [{ name: 'Date', required: true }],
        },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it('requires at least one section and at least one field per section', () => {
    expect(TemplateDefinition.safeParse(definitionWith([])).success).toBe(false);
    expect(
      TemplateDefinition.safeParse(
        definitionWith([{ name: 'Header', order: 0, required: true, fields: [] }]),
      ).success,
    ).toBe(false);
  });

  it('allows ratifiedAt to be null but not absent — draft definitions are representable', () => {
    const { ratifiedAt: _omitted, ...withoutRatifiedAt } = definitionWith([
      {
        name: 'Header',
        order: 0,
        required: true,
        fields: [{ name: 'Date', required: true }],
      },
    ]);
    expect(TemplateDefinition.safeParse(withoutRatifiedAt).success).toBe(false);
  });
});

describe('checkArtefactStructure', () => {
  const definition = TemplateDefinition.parse(
    definitionWith([
      {
        name: 'Header',
        order: 0,
        required: true,
        fields: [
          { name: 'Date', required: true },
          { name: 'Class', required: false },
        ],
      },
      {
        name: 'Body',
        order: 1,
        required: true,
        fields: [{ name: 'Activities', required: true }],
      },
      {
        name: 'Extension',
        order: 2,
        required: false,
        fields: [{ name: 'Enrichment task', required: true }],
      },
    ]),
  );

  it('passes with no violations for a matching artefact', () => {
    const artefact: ArtefactStructure = {
      sections: [
        { name: 'Header', fields: ['Date'] },
        { name: 'Body', fields: ['Activities'] },
      ],
    };
    expect(checkArtefactStructure(definition, artefact)).toEqual([]);
  });

  it('flags a missing required section', () => {
    const artefact: ArtefactStructure = {
      sections: [{ name: 'Header', fields: ['Date'] }],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({ kind: 'missing_section', section: 'Body' });
  });

  it('does not flag a missing optional section', () => {
    const artefact: ArtefactStructure = {
      sections: [
        { name: 'Header', fields: ['Date'] },
        { name: 'Body', fields: ['Activities'] },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(
      violations.some((v) => v.kind === 'missing_section' && v.section === 'Extension'),
    ).toBe(false);
  });

  it('flags a section the definition does not declare', () => {
    const artefact: ArtefactStructure = {
      sections: [
        { name: 'Header', fields: ['Date'] },
        { name: 'Body', fields: ['Activities'] },
        { name: 'Homework', fields: ['Task'] },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({
      kind: 'unexpected_section',
      section: 'Homework',
    });
  });

  it('flags sections present but out of order', () => {
    const artefact: ArtefactStructure = {
      sections: [
        { name: 'Body', fields: ['Activities'] },
        { name: 'Header', fields: ['Date'] },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations.some((v) => v.kind === 'out_of_order')).toBe(true);
  });

  it('flags a missing required field within a present section', () => {
    const artefact: ArtefactStructure = {
      sections: [
        { name: 'Header', fields: [] },
        { name: 'Body', fields: ['Activities'] },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations).toContainEqual({
      kind: 'missing_field',
      section: 'Header',
      field: 'Date',
    });
  });

  it('does not flag a missing optional field', () => {
    const artefact: ArtefactStructure = {
      sections: [
        { name: 'Header', fields: ['Date'] },
        { name: 'Body', fields: ['Activities'] },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(
      violations.some((v) => v.kind === 'missing_field' && v.field === 'Class'),
    ).toBe(false);
  });

  it('still checks position and required fields for a present optional section', () => {
    const artefact: ArtefactStructure = {
      sections: [
        { name: 'Header', fields: ['Date'] },
        { name: 'Extension', fields: [] },
        { name: 'Body', fields: ['Activities'] },
      ],
    };
    const violations = checkArtefactStructure(definition, artefact);
    expect(violations.some((v) => v.kind === 'out_of_order')).toBe(true);
    expect(violations).toContainEqual({
      kind: 'missing_field',
      section: 'Extension',
      field: 'Enrichment task',
    });
  });
});
