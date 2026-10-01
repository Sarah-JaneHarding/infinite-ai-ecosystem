import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, it, expect } from 'vitest';

import { ROLE_HOME, ROLE_NAV } from '../../src/lib/roles.js';

// Every link the shell shows must land on a page. This list is a ratchet, not an excuse:
// these links were dead when the check was written, and are still unfixed. The test fails
// when a NEW dead link appears, and fails again when one of these gets a page without being
// removed here — so the list can only shrink.
const KNOWN_DEAD = ['/hod/coverage', '/sbst/meetings', '/smt/pd', '/smt/tiers'];

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
  it('has no dead link beyond the known ones', () => {
    const dead = hrefs.filter((h) => !hasPage(h)).sort();
    expect(dead).toEqual(KNOWN_DEAD);
  });

  it('links to the approvals queue and no longer to a tenant directory', () => {
    expect(hasPage('/approvals')).toBe(true);
    expect(hrefs).not.toContain('/platform/tenants');
  });
});
