import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

import { GuardianPortal } from '../../src/components/guardian/GuardianPortal.js';

// OQ-056: the Parent Portal used to show school notices, dates and a progress promise that
// no school supplied. A parent reads them as the school's own words. None may come back, and
// the page may not claim a restriction or a feature it does not have.

const html = renderToStaticMarkup(createElement(GuardianPortal));
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('Parent Portal shows nothing it cannot back up', () => {
  it('carries none of the invented notices, dates or promises', () => {
    for (const invented of [
      'Term 3',
      '25 August',
      '3 September',
      '18:00',
      'Parent evening',
      'results available',
      'will be shared',
      'about your child is shown',
    ]) {
      expect(text).not.toContain(invented);
    }
  });

  it('contains no date or time at all', () => {
    expect(text).not.toMatch(
      /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
    );
    expect(text).not.toMatch(/\b\d{1,2}:\d{2}\b/);
  });

  it('says plainly that there is nothing to show and that nothing comes from the school', () => {
    expect(text).toContain('Nothing to show yet');
    expect(text).toContain('nothing on this page comes from your child');
    expect(text).toContain('ask the school directly');
  });

  it('announces its state to assistive technology', () => {
    expect(html).toMatch(/role="status"/);
    expect(html).toMatch(/aria-labelledby="guardian-heading"/);
    expect(html).toContain('id="guardian-heading"');
  });

  it('reads no school or learner record (no data imports in the component)', () => {
    const src = readFileSync(
      fileURLToPath(
        new URL('../../src/components/guardian/GuardianPortal.tsx', import.meta.url),
      ),
      'utf8',
    );
    const imports = src.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual([
      "import { Badge, Card } from '@infinite-ai/design-system';",
    ]);
  });
});
