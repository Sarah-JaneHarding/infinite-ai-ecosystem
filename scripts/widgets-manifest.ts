// Writes widgets/MANIFEST.json: one entry per built widget with its sha256, size, widget id and
// version (read from the widget's own `iai-manifest` block). Run after adding or changing a widget:
//   pnpm widgets:manifest
// The registry test (packages/widget-registry/test/widget-files.spec.ts) fails if a file and the
// manifest disagree, so a widget cannot change without the change being visible in review.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'widgets');
const dir = join(root, 'built');

function embeddedIdentity(
  file: string,
  raw: string,
): { widgetId: string; version: string } {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null)
    throw new Error(`${file}: manifest is not an object`);
  const { widgetId, version } = parsed as Record<string, unknown>;
  if (typeof widgetId !== 'string' || widgetId.length === 0)
    throw new Error(`${file}: no widgetId`);
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`${file}: version must be MAJOR.MINOR.PATCH`);
  }
  return { widgetId, version };
}

const entries = readdirSync(dir)
  .filter((f) => f.endsWith('.html'))
  .sort()
  .map((file) => {
    const bytes = readFileSync(join(dir, file));
    const html = bytes.toString('utf8');
    const m =
      /<script type="application\/json" id="iai-manifest">([\s\S]*?)<\/script>/.exec(
        html,
      );
    if (!m?.[1]) throw new Error(`${file}: no iai-manifest block`);
    const embedded = embeddedIdentity(file, m[1]);
    return {
      file,
      widgetId: embedded.widgetId,
      version: embedded.version,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
    };
  });

writeFileSync(
  join(root, 'MANIFEST.json'),
  `${JSON.stringify({ widgets: entries }, null, 2)}\n`,
);
process.stdout.write(`${entries.length} widgets written to widgets/MANIFEST.json\n`);
