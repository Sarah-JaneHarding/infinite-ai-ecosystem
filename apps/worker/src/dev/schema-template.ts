// Builds a fill-in-the-blanks JSON template from a Zod schema, so a developer can see what
// an agent or pipeline input must look like without reading the schema source. Required
// fields only; a union shows its first option. Placeholders are obvious (`"<string>"`) and
// the result is a starting point, not a guaranteed-valid input — callers validate after.

import type { z } from 'zod';

const PLACEHOLDER_UUID = '00000000-0000-4000-8000-000000000000';

interface Def {
  readonly typeName?: string;
  readonly [key: string]: unknown;
}

function defOf(schema: z.ZodTypeAny): Def {
  return schema._def as Def;
}

export function templateFor(schema: z.ZodTypeAny): unknown {
  const def = defOf(schema);
  switch (def.typeName) {
    case 'ZodString': {
      const checks = (def['checks'] ?? []) as readonly { kind: string }[];
      if (checks.some((c) => c.kind === 'uuid')) return PLACEHOLDER_UUID;
      if (checks.some((c) => c.kind === 'datetime')) return '2026-01-01T00:00:00.000Z';
      return '<string>';
    }
    case 'ZodNumber':
    case 'ZodBigInt':
      return 0;
    case 'ZodBoolean':
      return false;
    case 'ZodNull':
      return null;
    case 'ZodLiteral':
      return def['value'];
    case 'ZodEnum':
      return (def['values'] as readonly unknown[])[0];
    case 'ZodNativeEnum':
      return Object.values(def['values'] as Record<string, unknown>)[0];
    case 'ZodArray':
      return [templateFor(def['type'] as z.ZodTypeAny)];
    case 'ZodRecord':
      return {};
    case 'ZodObject': {
      const shape = (schema as z.AnyZodObject).shape as Record<string, z.ZodTypeAny>;
      const out: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(shape)) {
        if (field.isOptional()) continue;
        out[key] = templateFor(field);
      }
      return out;
    }
    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
    case 'ZodReadonly':
    case 'ZodBranded':
    case 'ZodCatch':
      return templateFor((def['innerType'] ?? def['type']) as z.ZodTypeAny);
    case 'ZodEffects':
      return templateFor(def['schema'] as z.ZodTypeAny);
    case 'ZodUnion':
      return templateFor((def['options'] as readonly z.ZodTypeAny[])[0] as z.ZodTypeAny);
    case 'ZodDiscriminatedUnion':
      return templateFor(
        [...(def['options'] as Iterable<z.ZodTypeAny>)][0] as z.ZodTypeAny,
      );
    default:
      return '<value>';
  }
}

/** Shallow-merges object templates; later keys do not overwrite earlier ones. */
export function mergeTemplates(templates: readonly unknown[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const template of templates) {
    if (typeof template !== 'object' || template === null || Array.isArray(template)) {
      continue;
    }
    for (const [key, value] of Object.entries(template)) {
      if (!(key in merged)) merged[key] = value;
    }
  }
  return merged;
}
