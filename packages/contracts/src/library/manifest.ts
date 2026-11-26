// Document Studio — the shape of docs/library/manifest.json.
//
// Every file the vendor shipped is listed with its SHA-256 and size, so the corpus test can
// prove the committed bytes are the supplied bytes. README.md and manifest.json themselves
// are not listed.

import { z } from 'zod';

export const LibraryFileFormat = z.enum(['docx', 'xlsx', 'html', 'md', 'json']);
export type LibraryFileFormat = z.infer<typeof LibraryFileFormat>;

export const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

export const LibraryManifestFile = z.object({
  ext: LibraryFileFormat,
  path: z.string().min(1),
  sha256: Sha256Hex,
  bytes: z.number().int().nonnegative(),
});
export type LibraryManifestFile = z.infer<typeof LibraryManifestFile>;

export const LibraryManifestItem = z.object({
  id: z.string().regex(/^lib-[a-z0-9-]+$/),
  title: z.string().min(1),
  group: z.enum(['business', 'customer']),
  dept: z.string().min(1),
  kind: z.string().min(1),
  review: z.string().nullable(),
  law: z.array(z.string()),
  files: z.array(LibraryManifestFile),
});
export type LibraryManifestItem = z.infer<typeof LibraryManifestItem>;

export const LibraryManifest = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(LibraryManifestItem),
});
export type LibraryManifest = z.infer<typeof LibraryManifest>;
