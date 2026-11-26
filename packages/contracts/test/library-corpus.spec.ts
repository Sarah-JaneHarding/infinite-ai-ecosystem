// Document Studio, Task 1 — the committed library under docs/library/ matches its contracts.
//
// The library is vendor-supplied data that the studio will edit as revisions. These tests are
// the proof that every document parses against LibraryDocumentContent and that the manifest
// still describes exactly the bytes on disk.

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { LibraryDocumentContent, LibraryManifest } from '../src/library/index.js';

const LIBRARY_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/library',
);

function jsonDocumentPaths(): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(LIBRARY_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const file of readdirSync(join(LIBRARY_DIR, entry.name))) {
      if (/^lib-.+\.json$/.test(file)) paths.push(join(LIBRARY_DIR, entry.name, file));
    }
  }
  return paths.sort();
}

function readManifest(): unknown {
  return JSON.parse(readFileSync(join(LIBRARY_DIR, 'manifest.json'), 'utf8')) as unknown;
}

describe('docs/library corpus', () => {
  it('parses all 120 documents against LibraryDocumentContent', () => {
    const paths = jsonDocumentPaths();
    expect(paths).toHaveLength(120);

    const failures: string[] = [];
    for (const path of paths) {
      const parsed = LibraryDocumentContent.safeParse(
        JSON.parse(readFileSync(path, 'utf8')) as unknown,
      );
      if (!parsed.success) failures.push(`${path}: ${parsed.error.message}`);
    }
    expect(failures).toEqual([]);
  });

  it('manifest lists 120 items and every file hash matches the file on disk', () => {
    const manifest = LibraryManifest.parse(readManifest());
    expect(manifest.count).toBe(120);
    expect(manifest.items).toHaveLength(120);

    const files = manifest.items.flatMap((item) => item.files);
    // 98 documents ship four formats and 22 ship five; README.md and manifest.json are not hashed.
    expect(files).toHaveLength(502);

    const mismatches: string[] = [];
    for (const file of files) {
      const full = join(LIBRARY_DIR, file.path);
      if (!existsSync(full)) {
        mismatches.push(`${file.path}: missing`);
        continue;
      }
      const bytes = readFileSync(full);
      if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
        mismatches.push(`${file.path}: sha256 differs`);
      }
      if (bytes.length !== file.bytes) mismatches.push(`${file.path}: size differs`);
    }
    expect(mismatches).toEqual([]);
  });

  it('every manifest id has a json file and a docx file', () => {
    const manifest = LibraryManifest.parse(readManifest());
    for (const item of manifest.items) {
      const exts = item.files.map((f) => f.ext);
      expect(exts, item.id).toContain('json');
      expect(exts, item.id).toContain('docx');
    }
  });

  it('has unique ids, two groups, and the expected review split', () => {
    const manifest = LibraryManifest.parse(readManifest());
    expect(new Set(manifest.items.map((i) => i.id)).size).toBe(120);
    expect(new Set(manifest.items.map((i) => i.group))).toEqual(
      new Set(['business', 'customer']),
    );
    expect(manifest.items.filter((i) => i.review !== null)).toHaveLength(65);
    expect(manifest.items.filter((i) => i.review === null)).toHaveLength(55);
  });

  it('manifest json paths are exactly the json documents on disk', () => {
    const manifest = LibraryManifest.parse(readManifest());
    const listed = manifest.items
      .flatMap((i) => i.files)
      .filter((f) => f.ext === 'json')
      .map((f) => join(LIBRARY_DIR, f.path))
      .sort();
    expect(listed).toEqual(jsonDocumentPaths());
  });
});
