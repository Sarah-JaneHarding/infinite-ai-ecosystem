import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';

import { RunInspector } from '../../src/components/platform/RunInspector.js';

const html = (): string => renderToStaticMarkup(RunInspector() as ReactElement);

// The inspector used to show sample runs as a "live view across all tenants". None of
// that may come back: no run, no tenant, no status, no table, no claim of a live view.
const INVENTED = [
  'run-a1b2',
  'run-c3d4',
  'run-e5f6',
  'CE-01',
  'TB-03',
  'PD-02',
  'tenant-001',
  'tenant-002',
  '1240ms',
  '2026-08-12',
  'Approved',
  'Rejected',
  'Pending review',
  'Live view',
  'across all tenants',
  '<table',
];

describe('Run Inspector', () => {
  it('shows no sample run, tenant, status or table, and no claim of a live view', () => {
    const out = html();
    for (const text of INVENTED) expect(out).not.toContain(text);
  });

  it('says plainly that it is not available yet, and why', () => {
    const out = html();
    expect(out).toContain('Not available yet');
    expect(out).toContain('there is no view of runs across schools');
    expect(out).toContain('administrator has approved');
    expect(out).toContain('not available in the app yet');
  });

  it('keeps the page title and the platform-access badge', () => {
    const out = html();
    expect(out).toContain('Run Inspector');
    expect(out).toContain('Platform access');
  });
});
