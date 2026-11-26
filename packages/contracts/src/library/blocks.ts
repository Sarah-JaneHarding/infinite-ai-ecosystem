// Document Studio — the block vocabulary of a library document.
//
// A library document is `{title, subtitle?, meta, blocks}`. The eight block shapes below are
// exactly those present in the supplied corpus (docs/library); `library-corpus.spec.ts` is the
// proof. Unknown block types are refused, so an edit can never smuggle in markup the exporters
// do not know how to render.

import { z } from 'zod';

export const LibraryBlock = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('h'),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string(),
  }),
  z.object({ type: z.literal('p'), text: z.string() }),
  z.object({ type: z.literal('ul'), items: z.array(z.string()) }),
  z.object({ type: z.literal('ol'), items: z.array(z.string()) }),
  z.object({ type: z.literal('kv'), pairs: z.array(z.tuple([z.string(), z.string()])) }),
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  z.object({ type: z.literal('callout'), tone: z.literal('warn'), text: z.string() }),
  z.object({
    type: z.literal('checklist'),
    checks: z.array(z.object({ label: z.string(), done: z.boolean() })),
  }),
]);
export type LibraryBlock = z.infer<typeof LibraryBlock>;

export const LibraryDocumentContent = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  meta: z.record(z.string(), z.string()),
  blocks: z.array(LibraryBlock),
});
export type LibraryDocumentContent = z.infer<typeof LibraryDocumentContent>;
