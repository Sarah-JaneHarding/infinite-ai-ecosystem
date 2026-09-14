import { describe, it, expect } from 'vitest';
import { ALERT_CATALOG } from '../src/alerts.js';
import { SLO_CATALOG } from '../src/slos.js';

describe('ALERT_CATALOG', () => {
  it('every alert has a non-empty name, owner, runbook and firstAction', () => {
    for (const rule of ALERT_CATALOG) {
      expect(rule.name.length, `${rule.name}: name`).toBeGreaterThan(0);
      expect(rule.owner.length, `${rule.name}: owner`).toBeGreaterThan(0);
      expect(rule.runbook.length, `${rule.name}: runbook`).toBeGreaterThan(0);
      expect(rule.firstAction.length, `${rule.name}: firstAction`).toBeGreaterThan(0);
    }
  });

  it('every alert severity is one of page | ticket | watch', () => {
    const valid = new Set(['page', 'ticket', 'watch']);
    for (const rule of ALERT_CATALOG) {
      expect(valid.has(rule.severity), `${rule.name}: severity ${rule.severity}`).toBe(
        true,
      );
    }
  });

  it('every alert runbook ends with .md', () => {
    for (const rule of ALERT_CATALOG) {
      expect(rule.runbook.endsWith('.md'), `${rule.name}: runbook ${rule.runbook}`).toBe(
        true,
      );
    }
  });

  it('every SLO in the catalog has at least one alert referencing it', () => {
    const alertedSlos = new Set(ALERT_CATALOG.map((r) => r.slo));
    for (const slo of SLO_CATALOG) {
      expect(alertedSlos.has(slo.name), `SLO ${slo.name} has no alert`).toBe(true);
    }
  });

  it('every SLO alert rule name is referenced by the SLO catalog', () => {
    const catalogAlertRules = new Set(SLO_CATALOG.map((s) => s.alertRule));
    for (const rule of ALERT_CATALOG) {
      if (catalogAlertRules.has(rule.name)) {
        expect(rule.slo).toBeTruthy();
      }
    }
  });

  it('the five required alerts from the manual exist', () => {
    const names = new Set(ALERT_CATALOG.map((r) => r.name));
    expect(names.has('web_availability_burn_rate')).toBe(true);
    expect(names.has('agent_run_failure_burst')).toBe(true);
    expect(names.has('time_to_artefact_p95_exceeded')).toBe(true);
    expect(names.has('approval_queue_age_exceeded')).toBe(true);
    expect(names.has('ingest_freshness_stale')).toBe(true);
  });

  it('paging alerts have a runbook that names a database or region recovery procedure', () => {
    const pagers = ALERT_CATALOG.filter((r) => r.severity === 'page');
    expect(pagers.length).toBeGreaterThan(0);
    for (const rule of pagers) {
      expect(rule.runbook.length).toBeGreaterThan(0);
    }
  });
});
