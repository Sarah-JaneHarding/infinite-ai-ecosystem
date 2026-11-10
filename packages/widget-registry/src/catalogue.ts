// @infinite-ai/widget-registry — the classroom toolbox catalogue.
//
// A reviewed list of 64 classroom tools found on other platforms, each with a build priority and
// the kind of data it would touch. It is a planning register, not a runtime feature: nothing here
// builds a widget. The data kind matters because a tool that needs a microphone, a network call
// or learner names cannot ship under the platform's POPIA rules without a decision (docs/POPIA.md).

import { z } from 'zod';

export const CataloguePriority = z.enum(['BUILT', 'P1', 'P2', 'P3', 'NO']);
export type CataloguePriority = z.infer<typeof CataloguePriority>;

/** What a tool would touch. `codes` means learner codes only; `learner` and `personal` need a purpose and a decision. */
export const CatalogueDataKind = z.enum([
  'none',
  'codes',
  'learner',
  'personal',
  'microphone',
  'browser voice',
  'AI',
  'network',
]);
export type CatalogueDataKind = z.infer<typeof CatalogueDataKind>;

export const CatalogueTool = z.object({
  id: z.string().regex(/^T\d{2}$/, 'tool id must look like T01'),
  category: z.string().min(2),
  name: z.string().min(2),
  what: z.string().min(5),
  foundIn: z.string().min(2),
  data: CatalogueDataKind,
  priority: CataloguePriority,
  note: z.string(),
});
export type CatalogueTool = z.infer<typeof CatalogueTool>;

export const CataloguePlatform = z.object({
  name: z.string().min(2),
  what: z.string().min(5),
  howChecked: z.string().min(5),
});
export type CataloguePlatform = z.infer<typeof CataloguePlatform>;

export const ToolboxCatalogue = z
  .object({
    generated: z.string().date(),
    tools: z.array(CatalogueTool).min(1),
    platforms: z.array(CataloguePlatform),
  })
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    for (const [i, t] of c.tools.entries()) {
      if (seen.has(t.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tools', i, 'id'],
          message: `duplicate tool id ${t.id}`,
        });
      }
      seen.add(t.id);
      if (t.priority === 'NO' && t.note.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['tools', i, 'note'],
          message: `${t.id} is marked NO and must say why`,
        });
      }
      if (t.priority === 'BUILT' && t.note.trim().length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['tools', i, 'note'],
          message: `${t.id} is marked BUILT and must name the widget that covers it`,
        });
      }
    }
  });
export type ToolboxCatalogue = z.infer<typeof ToolboxCatalogue>;

export type PriorityCounts = Record<CataloguePriority, number>;

export function countByPriority(tools: readonly CatalogueTool[]): PriorityCounts {
  const counts: PriorityCounts = { BUILT: 0, P1: 0, P2: 0, P3: 0, NO: 0 };
  for (const t of tools) counts[t.priority] += 1;
  return counts;
}

/** The next tools to build, in catalogue order. A tool that touches a microphone, the network or personal data is never offered here. */
export function nextToBuild(
  tools: readonly CatalogueTool[],
  priority: Exclude<CataloguePriority, 'BUILT' | 'NO'> = 'P1',
): CatalogueTool[] {
  const blocked: readonly CatalogueDataKind[] = [
    'microphone',
    'network',
    'personal',
    'learner',
  ];
  return tools.filter((t) => t.priority === priority && !blocked.includes(t.data));
}

/** Tools that need a decision before they can be built (a data kind the platform has not cleared). */
export function needsDecision(tools: readonly CatalogueTool[]): CatalogueTool[] {
  const blocked: readonly CatalogueDataKind[] = [
    'microphone',
    'network',
    'personal',
    'learner',
  ];
  return tools.filter(
    (t) => t.priority !== 'BUILT' && t.priority !== 'NO' && blocked.includes(t.data),
  );
}
