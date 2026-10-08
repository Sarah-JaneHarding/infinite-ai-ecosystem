import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ComponentType } from 'react';

import { MtssOverviewView } from '../../src/components/sbst/MtssOverviewView.js';
import { SiasPipelineView } from '../../src/components/sbst/SiasPipelineView.js';
import { SbstCasebook } from '../../src/components/sbst/SbstCasebook.js';

const render = (component: ComponentType): string =>
  renderToStaticMarkup(createElement(component));

// These tabs used to show invented learners, tiers, dates, SIAS cases and phases, plus an
// assertion of what the DoE SIAS Guidelines require. None of it may come back: no learner,
// no case, no tier count, no table, and no process claim that no source supplied. Every
// panel renders (hidden or not), so the whole casebook is checked, not only the active tab.
const INVENTED = [
  'L-001',
  'L-005',
  'L-010',
  '2026-08-12',
  '2026-08-13',
  '2026-08-14',
  'SIAS-001',
  'SIAS-005',
  '2026-09-10',
  'Assessment scheduled',
  'Support plan active',
  'Teacher referral received',
  'ILST review',
  'Progress monitoring',
  'Phase 1',
  'Phase 2',
  'Phase 3',
  'Phase 4',
  'Learners screened',
  'MTSS tier distribution',
  'Class roster',
  'Class roster — universal screening results',
  'DoE SIAS Guidelines',
  'Escalation to district',
  'case coordinator',
  '<table',
];

describe('SBST tabs without data', () => {
  it('MTSS overview shows none of the invented roster, counts or dates', () => {
    const out = render(MtssOverviewView);
    for (const text of INVENTED) expect(out).not.toContain(text);
    expect(out).toContain('Not available yet');
    expect(out).toContain('No universal screening results are stored');
  });

  it('SIAS pipeline shows none of the invented cases, phases or process claims', () => {
    const out = render(SiasPipelineView);
    for (const text of INVENTED) expect(out).not.toContain(text);
    expect(out).toContain('Not available yet');
    expect(out).toContain('SIAS cases are not stored in the app yet');
  });

  it('the whole casebook, every panel included, carries no invented data', () => {
    const out = render(SbstCasebook);
    for (const text of INVENTED) expect(out).not.toContain(text);
  });

  it('still offers the three tabs, and the EGRA tab still renders its form', () => {
    const out = render(SbstCasebook);
    expect(out).toContain('MTSS Overview');
    expect(out).toContain('EGRA Screening');
    expect(out).toContain('SIAS Pipeline');
    expect(out).toContain('Calculate tier recommendation');
  });
});
