import { describe, expect, it } from 'vitest';

import {
  DEV_TENANT_IDS,
  DevRunnerRefusalError,
  assertDevRun,
} from '../../src/dev/dev-guard.js';

describe('assertDevRun', () => {
  it('accepts each seeded fixture tenant outside production', () => {
    for (const tenantId of DEV_TENANT_IDS) {
      expect(() => assertDevRun({ nodeEnv: 'development', tenantId })).not.toThrow();
    }
  });

  it('refuses any tenant that is not a seeded fixture', () => {
    expect(() =>
      assertDevRun({
        nodeEnv: 'development',
        tenantId: '20000000-0000-4000-8000-000000000001',
      }),
    ).toThrow(DevRunnerRefusalError);
  });

  it('refuses to run in production even for a fixture tenant', () => {
    expect(() =>
      assertDevRun({ nodeEnv: 'production', tenantId: DEV_TENANT_IDS[0] as string }),
    ).toThrow(/production/);
  });
});
