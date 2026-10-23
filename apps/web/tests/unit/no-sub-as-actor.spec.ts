import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// OQ-033 regression guard. The OIDC `sub` proves who signed in; it is not the actor. Reading
// it in an API route is exactly how every gate decision came to fail the role check, and how
// the audit ledger would have recorded an id no `role_assignment` points at. Routes get the
// actor from `readTokenActor`; the only place the subject is read is auth.ts, to resolve the
// account once.
const SRC = join(__dirname, '..', '..', 'src');

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

describe('no route takes the provider subject for the actor', () => {
  const routes = filesUnder(join(SRC, 'app', 'api')).filter((f) =>
    f.endsWith('route.ts'),
  );

  it('finds the API routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(4);
  });

  it.each(routes.map((f) => [f.slice(SRC.length + 1), f]))(
    '%s does not read token.sub',
    (_name, file) => {
      expect(readFileSync(file as string, 'utf8')).not.toMatch(/token\??\.sub\b/);
    },
  );
});
