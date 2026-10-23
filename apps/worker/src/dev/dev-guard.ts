// Guard rails for the dev runners (`pnpm dev:run-agent`, `evals:run-live`,
// `dev:run-pipeline`).
//
// These tools stamp their prompts `deidentified: true` the same way the worker does for
// curriculum pipelines, and they take their input from a file a developer wrote. That is
// only honest for synthetic data, so they refuse anything but the seeded fixture tenants
// and refuse to run at all under NODE_ENV=production. They do not weaken any control: the
// gateway still checks every payload against the tenant's learner-name lexicon (rule 4),
// and a human gate in a pipeline still waits for a person (rule 6).

export const DEV_TENANT_IDS: readonly string[] = [
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
];

/** The tenant the runners use when none is given: Kleinbos Primary. */
export const DEFAULT_DEV_TENANT_ID = DEV_TENANT_IDS[0] as string;

/** The acting identity recorded on runs a dev runner starts. A system actor, not a user. */
export const DEV_RUNNER_ACTOR_ID = '00000000-0000-4000-8000-000000000005';

export class DevRunnerRefusalError extends Error {
  public override readonly name = 'DevRunnerRefusalError';
}

export function assertDevRun(options: {
  readonly nodeEnv: string;
  readonly tenantId: string;
}): void {
  if (options.nodeEnv === 'production') {
    throw new DevRunnerRefusalError(
      'The dev runners never run with NODE_ENV=production.',
    );
  }
  if (!DEV_TENANT_IDS.includes(options.tenantId)) {
    throw new DevRunnerRefusalError(
      `Tenant ${options.tenantId} is not one of the seeded fixture tenants ` +
        `(${DEV_TENANT_IDS.join(', ')}). The dev runners only handle synthetic data.`,
    );
  }
}
