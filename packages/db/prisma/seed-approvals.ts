// Seeds the open human gates in approval-fixtures.ts — development only.
//
// `pnpm --filter @infinite-ai/db db:seed:approvals`, after `db:seed` (the tenants must
// exist). Run it as the migrator, like db:seed. Idempotent: every write is an upsert on a
// fixed id, and the upsert's update is empty, so a second run changes nothing.

import { PrismaClient } from '@prisma/client';

import { APPROVAL_FIXTURES, type ApprovalFixture } from './approval-fixtures.js';

/** The same provenance actor seed.ts uses. */
const SEED_ACTOR = '00000000-0000-4000-8000-00000000f00d';

export async function seedApprovals(
  prisma: PrismaClient,
  fixtures: readonly ApprovalFixture[] = APPROVAL_FIXTURES,
): Promise<number> {
  for (const f of fixtures) {
    // One transaction per gate, with the tenant context set first — the same contract the
    // production client enforces, so RLS is exercised rather than bypassed.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${f.tenantId}, true)`;
      await tx.$executeRaw`SELECT set_config('app.actor_id', ${SEED_ACTOR}, true)`;
      await tx.orchestratorRun.upsert({
        where: { id: f.runId },
        update: {},
        create: {
          id: f.runId,
          tenantId: f.tenantId,
          pipelineId: 'dev-fixture',
          pipelineVersion: '0.0.0',
          traceId: f.traceId,
          input: { devFixture: true },
          createdBy: SEED_ACTOR,
        },
      });
      await tx.approvalTask.upsert({
        where: { id: f.taskId },
        update: {},
        create: {
          id: f.taskId,
          tenantId: f.tenantId,
          runId: f.runId,
          stepId: f.stepId,
          requiredRole: f.requiredRole,
          artefact: f.artefact,
          evidence: f.evidence,
          ...(f.diffAgainstPrevious === null
            ? {}
            : { diffAgainstPrevious: f.diffAgainstPrevious }),
          traceId: f.traceId,
        },
      });
    });
  }
  return fixtures.length;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const count = await seedApprovals(prisma);
    console.log(`seeded ${count} dev approval gates`);
  } finally {
    await prisma.$disconnect();
  }
}

// Only run when invoked directly, so importing this module for tests does not seed.
if (process.argv[1]?.endsWith('seed-approvals.ts') === true) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
