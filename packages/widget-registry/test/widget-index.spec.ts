import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The widget archive under apps/web/public/widgets is data the registry will wire. These
// tests pin the archive to its index so a file cannot change without the index (and so the
// release hash a person ratifies) changing with it.
const dir = join(__dirname, '..', '..', '..', 'apps', 'web', 'public', 'widgets');

interface Row {
  widgetId: string;
  file: string;
  agentId: string | null;
  humanGate: { role: string } | null;
  sha256: string;
}
const index = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')) as {
  count: number;
  widgets: Row[];
};
const files = readdirSync(dir).filter((f) => f.endsWith('.html'));

describe('widget archive index', () => {
  it('lists every widget file once, and nothing else', () => {
    expect(index.count).toBe(index.widgets.length);
    expect(index.widgets.map((w) => w.file).sort()).toEqual([...files].sort());
    expect(new Set(index.widgets.map((w) => w.widgetId)).size).toBe(files.length);
  });

  it('records the real hash of each file', () => {
    for (const w of index.widgets) {
      const hash = createHash('sha256')
        .update(readFileSync(join(dir, w.file)))
        .digest('hex');
      expect(hash, w.file).toBe(w.sha256);
    }
  });

  it('gives every widget a human gate (nothing is approved without a person)', () => {
    for (const w of index.widgets) expect(w.humanGate?.role, w.widgetId).toBeTruthy();
  });

  it('holds the 80 widgets handed over: 13 CE, 9 DW, 19 PD, 7 PF, 12 SA, 20 TB', () => {
    const n = (p: string): number =>
      index.widgets.filter((w) => w.widgetId.startsWith(p)).length;
    expect([n('CE-'), n('DW-'), n('PD-'), n('PF-'), n('SA-'), n('TB-')]).toEqual([
      13, 9, 19, 7, 12, 20,
    ]);
  });
});

describe('classroom tools TB-W14 to TB-W20', () => {
  const tools = index.widgets.filter((w) => /^TB-W(1[4-9]|20)$/.test(w.widgetId));

  it('are the seven deterministic tools: no AI agent', () => {
    expect(tools).toHaveLength(7);
    for (const w of tools) expect(w.agentId, w.widgetId).toBeNull();
  });

  it('make no network calls, use no dynamic code and no microphone', () => {
    const banned =
      /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|\beval\s*\(|new Function\s*\(|getUserMedia|https?:\/\//;
    for (const w of tools) {
      expect(banned.test(readFileSync(join(dir, w.file), 'utf8')), w.widgetId).toBe(
        false,
      );
    }
  });
});

describe('toolbox catalogue', () => {
  const catalogue = JSON.parse(
    readFileSync(
      join(__dirname, '..', '..', '..', 'docs', 'data', 'toolbox-catalogue.json'),
      'utf8',
    ),
  ) as { tools: { id: string; priority: string; note: string }[] };

  it('has 64 tools with the stated split', () => {
    const n = (p: string): number =>
      catalogue.tools.filter((t) => t.priority === p).length;
    expect(catalogue.tools).toHaveLength(64);
    expect([n('BUILT'), n('P1'), n('P2'), n('P3'), n('NO')]).toEqual([12, 17, 18, 10, 7]);
  });

  it('only names widgets that exist in the archive', () => {
    const ids = new Set(index.widgets.map((w) => w.widgetId));
    for (const t of catalogue.tools) {
      for (const ref of t.note.match(/TB-W\d{2}/g) ?? [])
        expect(ids.has(ref), `${t.id} ${ref}`).toBe(true);
    }
  });

  it('points every BUILT tool at a widget or the shared classroom kit', () => {
    for (const t of catalogue.tools.filter((x) => x.priority === 'BUILT')) {
      expect(/TB-W\d{2}|classroom kit/.test(t.note), t.id).toBe(true);
    }
  });
});
