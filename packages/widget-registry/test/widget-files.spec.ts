// The widgets under widgets/ are generated single-file HTML. This test keeps the committed files, the
// manifest and the privacy boundary honest: a widget cannot change without its hash changing in review.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const root = join(import.meta.dirname, '..', '..', '..', 'widgets');
const built = join(root, 'built');

const Manifest = z.object({
  widgets: z.array(
    z.object({
      file: z.string().endsWith('.html'),
      widgetId: z.string().regex(/^[A-Z]{2}-W\d{2}$/),
      version: z.string().regex(/^\d+\.\d+\.\d+$/),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      bytes: z.number().int().positive(),
    }),
  ),
});
const manifest = Manifest.parse(
  JSON.parse(readFileSync(join(root, 'MANIFEST.json'), 'utf8')),
);

describe('widgets/MANIFEST.json', () => {
  it('lists exactly the files in widgets/built, with matching hashes and sizes', () => {
    const onDisk = readdirSync(built)
      .filter((f) => f.endsWith('.html'))
      .sort();
    expect(manifest.widgets.map((w) => w.file).sort()).toEqual(onDisk);
    for (const w of manifest.widgets) {
      const bytes = readFileSync(join(built, w.file));
      expect(createHash('sha256').update(bytes).digest('hex'), w.file).toBe(w.sha256);
      expect(bytes.length, w.file).toBe(w.bytes);
    }
  });

  it('has one file per widget id and the id appears in the file name', () => {
    const ids = manifest.widgets.map((w) => w.widgetId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const w of manifest.widgets)
      expect(w.file).toContain(`INFINITE-AI-${w.widgetId}`);
  });

  it('includes the Wiring Board, the Studio layer and the seven classroom tools', () => {
    const ids = new Set(manifest.widgets.map((w) => w.widgetId));
    for (const id of [
      'PF-W06',
      'PF-W04',
      'TB-W01',
      'PD-W01',
      'CE-W01',
      'DW-W01',
      'SA-W01',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
    for (let n = 14; n <= 20; n += 1) expect(ids.has(`TB-W${n}`), `TB-W${n}`).toBe(true);
  });

  it('refuses a manifest entry with a bad hash', () => {
    const bad = Manifest.safeParse({
      widgets: [{ ...manifest.widgets[0], sha256: 'abc' }],
    });
    expect(bad.success).toBe(false);
  });
});

describe('classroom tools TB-W14 to TB-W20: privacy boundary', () => {
  const tools = manifest.widgets.filter((w) => /^TB-W(1[4-9]|20)$/.test(w.widgetId));

  it('finds all seven', () => {
    expect(tools).toHaveLength(7);
  });

  it.each(tools.map((w) => [w.widgetId, w.file] as const))(
    '%s makes no network call, runs no dynamic code, loads nothing from outside and uses no microphone',
    (_id, file) => {
      const html = readFileSync(join(built, file), 'utf8');
      expect(html).not.toMatch(/\bfetch\s*\(/);
      expect(html).not.toMatch(/XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
      expect(html).not.toMatch(/\beval\s*\(|new\s+Function\s*\(/);
      expect(html).not.toMatch(/getUserMedia|webkitSpeechRecognition|SpeechRecognition/);
      expect(html).not.toMatch(/\b(?:src|href)\s*=\s*["']https?:\/\//i);
    },
  );
});
