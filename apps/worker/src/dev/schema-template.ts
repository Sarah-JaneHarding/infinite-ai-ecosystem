// Builds a fill-in-the-blanks JSON template from a Zod schema, so a developer can see what
// an agent or pipeline input must look like without reading the schema source. Required
// fields only; a union shows its first option. Placeholders are obvious (`"<string>"`) and
// the result is a starting point, not a guaranteed-valid input - callers validate after.
//
// Written against zod 4: a schema describes itself through `schema._zod.def`, whose `type`
// names the kind ('string', 'object', 'optional', ...). A string's format ('uuid', 'guid',
// 'datetime', ...) is the public `schema.format`.

import type { z } from 'zod';

const PLACEHOLDER_UUID = '00000000-0000-4000-8000-000000000000';

interface Def {
  readonly type?: string;
  readonly [key: string]: unknown;
}

function defOf(schema: z.ZodType): Def {
  return (schema as unknown as { _zod: { def: Def } })._zod.def;
}

const asSchema = (value: unknown): z.ZodType => value as z.ZodType;

export function templateFor(schema: z.ZodType): unknown {
  const def = defOf(schema);
  switch (def.type) {
    case 'string': {
      const format = (schema as z.ZodString).format;
      if (format === 'uuid' || format === 'guid') return PLACEHOLDER_UUID;
      if (format === 'datetime') return '2026-01-01T00:00:00.000Z';
      return '<string>';
    }
    case 'number':
    case 'int':
    case 'bigint':
      return 0;
    case 'boolean':
      return false;
    case 'null':
      return null;
    case 'literal':
      return [...(def['values'] as Iterable<unknown>)][0];
    case 'enum':
      return (schema as z.ZodEnum).options[0];
    case 'array':
      return [templateFor(asSchema(def['element']))];
    case 'record':
      return {};
    case 'object': {
      const shape = (schema as z.ZodObject).shape as Record<string, z.ZodType>;
      const out: Record<string, unknown> = {};
      for (const [key, field] of Object.entries(shape)) {
        // A field that accepts `undefined` is optional (covers .optional() and .default()).
        if (field.safeParse(undefined).success) continue;
        out[key] = templateFor(field);
      }
      return out;
    }
    case 'optional':
    case 'nullable':
    case 'default':
    case 'prefault':
    case 'readonly':
    case 'catch':
    case 'nonoptional':
      return templateFor(asSchema(def['innerType']));
    case 'pipe':
      return templateFor(asSchema(def['in']));
    case 'union':
      return templateFor(asSchema((def['options'] as readonly unknown[])[0]));
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
