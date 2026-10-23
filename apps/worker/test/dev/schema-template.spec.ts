import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { mergeTemplates, templateFor } from '../../src/dev/schema-template.js';

describe('templateFor', () => {
  it('fills required fields with obvious placeholders and skips optional ones', () => {
    const schema = z.object({
      name: z.string(),
      count: z.number(),
      id: z.guid(),
      phase: z.enum(['FOUNDATION', 'SENIOR']),
      tags: z.array(z.string()),
      note: z.string().optional(),
      nested: z.object({ ok: z.boolean() }),
    });
    expect(templateFor(schema)).toEqual({
      name: '<string>',
      count: 0,
      id: '00000000-0000-4000-8000-000000000000',
      phase: 'FOUNDATION',
      tags: ['<string>'],
      nested: { ok: false },
    });
  });

  it('unwraps defaults, effects and unions to their first usable shape', () => {
    expect(templateFor(z.number().default(3))).toBe(0);
    expect(templateFor(z.string().refine((s) => s.length > 0))).toBe('<string>');
    expect(templateFor(z.union([z.literal('a'), z.literal('b')]))).toBe('a');
  });

  it('handles datetime strings, literals, transforms and nullable wrappers', () => {
    expect(templateFor(z.string().datetime())).toBe('2026-01-01T00:00:00.000Z');
    expect(templateFor(z.literal('ok'))).toBe('ok');
    expect(templateFor(z.string().transform((v) => v.length))).toBe('<string>');
    expect(templateFor(z.number().nullable())).toBe(0);
    expect(templateFor(z.record(z.string(), z.number()))).toEqual({});
  });

  it('produces a valid input for a real agent contract', () => {
    const schema = z.object({
      tenantId: z.guid(),
      grade: z.enum(['R', '1']),
      subjects: z.array(z.string()).min(1),
    });
    expect(schema.safeParse(templateFor(schema)).success).toBe(true);
  });

  it('falls back to a visible marker for a schema kind it does not know', () => {
    expect(templateFor(z.any())).toBe('<value>');
  });
});

describe('mergeTemplates', () => {
  it('keeps the first value for a repeated key and ignores non-objects', () => {
    expect(mergeTemplates([{ a: 1, b: 2 }, { a: 9, c: 3 }, 'x', null, [1]])).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });
});
