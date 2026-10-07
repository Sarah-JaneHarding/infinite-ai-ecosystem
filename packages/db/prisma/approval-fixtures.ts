// Development fixtures for the approvals screens: a handful of open human gates, so that
// /approvals, the HoD console and the SMT dashboard have something real-shaped to show.
//
// Nothing here is curriculum. A gate's artefact is free-form JSON that the gate's own
// pipeline will fill in; these carry a plainly marked placeholder instead, so a developer or
// a screenshot can never mistake one for real content. No staff member, learner or school is
// represented, and nothing here is personal information.
//
// Ids are fixed so seeding twice targets the same rows (the same idempotence rule as
// seed.ts): every write is an upsert on one of them.

/** The two dev tenants the gates are opened in — the same ids seed.ts uses. */
export const SMALL_PRIMARY = '10000000-0000-4000-8000-000000000001';
export const LARGE_PRIMARY = '10000000-0000-4000-8000-000000000002';

export interface ApprovalFixture {
  readonly tenantId: string;
  readonly runId: string;
  readonly taskId: string;
  readonly stepId: string;
  readonly requiredRole: 'teacher' | 'hod' | 'smt';
  readonly artefact: { readonly devFixture: true; readonly note: string };
  readonly evidence: { readonly devFixture: true };
  readonly diffAgainstPrevious: {
    readonly devFixture: true;
    readonly note: string;
  } | null;
  readonly traceId: string;
}

/** `ab000000-0000-4000-8000-0000000000NN` — structurally valid for `withTenant`, and
 * recognisably a fixture (the `ab`/`ac` prefix is used for nothing else). */
const id = (prefix: 'ab' | 'ac' | 'ad', n: number): string =>
  `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const NOTE =
  'Dev fixture. Placeholder content for exercising the approvals screens; not curriculum.';

function fixture(
  n: number,
  tenantId: string,
  stepId: string,
  requiredRole: ApprovalFixture['requiredRole'],
  withDiff = false,
): ApprovalFixture {
  return {
    tenantId,
    runId: id('ab', n),
    taskId: id('ac', n),
    stepId,
    requiredRole,
    artefact: { devFixture: true, note: NOTE },
    evidence: { devFixture: true },
    diffAgainstPrevious: withDiff
      ? {
          devFixture: true,
          note: 'Dev fixture. A placeholder change from an earlier version.',
        }
      : null,
    traceId: id('ad', n),
  };
}

export const APPROVAL_FIXTURES: readonly ApprovalFixture[] = [
  // Six for the HoD in the small primary: more than the console's five-row cap, so the
  // "and 1 more" line has something to say.
  fixture(1, SMALL_PRIMARY, 'dev-gate-1', 'hod'),
  fixture(2, SMALL_PRIMARY, 'dev-gate-2', 'hod', true),
  fixture(3, SMALL_PRIMARY, 'dev-gate-3', 'hod'),
  fixture(4, SMALL_PRIMARY, 'dev-gate-4', 'hod'),
  fixture(5, SMALL_PRIMARY, 'dev-gate-5', 'hod'),
  fixture(6, SMALL_PRIMARY, 'dev-gate-6', 'hod'),
  // Two for the SMT, one for a teacher.
  fixture(7, SMALL_PRIMARY, 'dev-gate-7', 'smt'),
  fixture(8, SMALL_PRIMARY, 'dev-gate-8', 'smt', true),
  fixture(9, SMALL_PRIMARY, 'dev-gate-9', 'teacher'),
  // One in ANOTHER tenant, waiting on the same role: nobody signed in to the small primary
  // may ever see it. It exists to make a leak visible.
  fixture(10, LARGE_PRIMARY, 'dev-gate-other-tenant', 'hod'),
];
