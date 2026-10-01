import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { ROLE_HOME, ROLE_NAV } from '../../src/lib/roles.js';

// Every link the shell shows must land on a page. A link is added together with its page,
// not before it.

const appDir = new URL('../../src/app/(shell)/', import.meta.url);
const hasPage = (href: string): boolean =>
  existsSync(fileURLToPath(new URL(`${href.slice(1)}/page.tsx`, appDir)));

const hrefs = [
  ...new Set([
    ...Object.values(ROLE_NAV).flatMap((links) => links.map((l) => l.href)),
    ...Object.values(ROLE_HOME),
  ]),
];

describe('shell navigation', () => {
  it('has no dead link', () => {
    expect(hrefs.filter((h) => !hasPage(h))).toEqual([]);
  });

  it('has no navigation entry for the surfaces that have no data behind them yet', () => {
    // See OQ-031. Re-add each with its page, once the data it needs exists.
    for (const href of ['/hod/coverage', '/smt/tiers', '/smt/pd', '/sbst/meetings']) {
      expect(hrefs).not.toContain(href);
    }
  });

  it('links to the approvals queue and no longer to a tenant directory', () => {
    expect(hasPage('/approvals')).toBe(true);
    expect(hrefs).not.toContain('/platform/tenants');
  });
});
