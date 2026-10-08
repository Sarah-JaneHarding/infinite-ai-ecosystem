import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

import { DistrictRollup } from '../../src/components/district/DistrictRollup.js';

const html = (): string => renderToStaticMarkup(DistrictRollup() as ReactElement);

// The rollup used to show three invented schools and tier percentages under a promise that a
// minimum cohort size was enforced. None of that may come back: no school, no count, no
// percentage, no table, and no assurance of a control the page does not exercise.
const INVENTED = [
  'School A',
  'School B',
  'School C',
  '501',
  '387',
  '620',
  '81%',
  '84%',
  '79%',
  'Minimum cohort size enforced',
  'Aggregated, de-identified data only',
  'tier distribution',
  '<table',
];

describe('District Rollup', () => {
  it('shows no sample school, count, percentage or table, and asserts no control', () => {
    const out = html();
    for (const text of INVENTED) expect(out).not.toContain(text);
  });

  it('says plainly that it is not available yet, and why', () => {
    const out = html();
    expect(out).toContain('Not available yet');
    expect(out).toContain('There is no district rollup');
    expect(out).toContain('stays with that school');
    expect(out).toContain('has not been made');
  });

  it('keeps the page title and the platform-access badge', () => {
    const out = html();
    expect(out).toContain('District Rollup');
    expect(out).toContain('Platform access');
  });
});
