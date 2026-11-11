// Builds (or checks) apps/web/public/widgets/index.json: one row per widget file, read from
// the widget's own `iai-manifest`. Nothing is invented: every field is copied from the
// manifest or computed from the file. Run `node scripts/build-widget-index.mjs` to write,
// `--check` to fail when the index is out of date with the files.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps',
  'web',
  'public',
  'widgets',
);
const MANIFEST =
  /<script type="application\/json" id="iai-manifest">([\s\S]*?)<\/script>/;

const rows = readdirSync(dir)
  .filter((f) => f.endsWith('.html'))
  .sort()
  .map((file) => {
    const html = readFileSync(join(dir, file));
    const text = html.toString('utf8');
    const found = MANIFEST.exec(text);
    if (found === null) throw new Error(`${file}: no iai-manifest`);
    const m = JSON.parse(found[1]);
    if (`${m.widgetId}.html` !== file)
      throw new Error(`${file}: widgetId is ${m.widgetId}`);
    return {
      widgetId: m.widgetId,
      file,
      name: m.name,
      module: m.module,
      version: m.version,
      agentId: m.agentId ?? null,
      humanGate: m.humanGate ?? null,
      emits: m.emits ?? [],
      upstream: m.upstream ?? [],
      studio: text.includes('IAI_STUDIO') || text.includes('iai-studio'),
      bytes: html.length,
      sha256: createHash('sha256').update(html).digest('hex'),
    };
  });

const out = `${JSON.stringify({ count: rows.length, widgets: rows }, null, 2)}\n`;
const target = join(dir, 'index.json');
if (process.argv.includes('--check')) {
  const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
  if (current !== out) {
    process.stderr.write(
      'widgets/index.json is out of date: run node scripts/build-widget-index.mjs\n',
    );
    process.exit(1);
  }
} else {
  writeFileSync(target, out);
  process.stdout.write(`wrote ${rows.length} widgets\n`);
}
