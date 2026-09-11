// @infinite-ai/testkit — Stage 01 step 10.
//
// "Factories that always require a tenant, plus a `withTenant()` test helper."
//
// The word doing the work is *always*. A factory whose tenant argument is optional, or
// defaulted, is a factory that will eventually be called without one — and a fixture
// created outside a tenant is how a test starts silently proving nothing. So the types
// here make a tenantless call impossible rather than merely discouraged: every factory
// takes a `TenantScope` as its first argument, and there is no overload that omits it.

import { randomUUID } from 'node:crypto';

/**
 * Who a fixture belongs to, and who created it.
 *
 * Mirrors `TenantContext` in @infinite-ai/db rather than importing it, so the testkit can
 * build fixtures for code that does not depend on the database package.
 */
export interface TenantScope {
  readonly tenantId: string;
  readonly actorId: string;
}

/** Creates a fresh scope. Ids are random per call, so tests cannot collide. */
export function tenantScope(overrides: Partial<TenantScope> = {}): TenantScope {
  return {
    tenantId: overrides.tenantId ?? randomUUID(),
    actorId: overrides.actorId ?? randomUUID(),
  };
}

/**
 * A factory bound to a tenant.
 *
 * The scope is the first parameter and is not optional. That is the point of the type:
 * `defineFactory` cannot express a factory that builds a tenantless row.
 */
export type Factory<T> = (scope: TenantScope, overrides?: Partial<T>) => T;

/**
 * Defines a factory from a builder that receives the scope and a sequence number.
 *
 * The sequence makes values unique without random noise in assertions — "Test Teacher 3"
 * reads better in a failure message than a UUID, and stays stable across runs.
 */
export function defineFactory<T extends object>(
  build: (scope: TenantScope, sequence: number) => T,
): Factory<T> {
  let sequence = 0;
  return (scope, overrides) => {
    sequence += 1;
    return { ...build(scope, sequence), ...overrides };
  };
}

// ---------------------------------------------------------------------------
// Core fixtures
// ---------------------------------------------------------------------------

export interface TenantFixture {
  id: string;
  name: string;
  slug: string;
  kind: 'SCHOOL' | 'SCHOOL_GROUP';
  createdBy: string;
}

export const aTenant: Factory<TenantFixture> = defineFactory(
  (scope, n): TenantFixture => ({
    id: scope.tenantId,
    name: `Test School ${n}`,
    slug: `test-school-${scope.tenantId.slice(0, 8)}-${n}`,
    kind: 'SCHOOL',
    createdBy: scope.actorId,
  }),
);

export interface SchoolFixture {
  tenantId: string;
  name: string;
  lolt: string;
  createdBy: string;
}

export const aSchool: Factory<SchoolFixture> = defineFactory(
  (scope, n): SchoolFixture => ({
    tenantId: scope.tenantId,
    name: `Campus ${n}`,
    lolt: 'en',
    createdBy: scope.actorId,
  }),
);

export interface LearnerFixture {
  tenantId: string;
  token: string;
  homeLanguage: string;
  createdBy: string;
}

/**
 * A learner fixture.
 *
 * Note what is absent: no name, no identifier, no date of birth. A learner is represented
 * by its tenant-salted token, because that is what may cross into any de-identified
 * context (rule 4). A factory that produced a plausible-looking legal name would make it
 * easy to write a test that leaks one, and easy to copy that pattern into real code.
 */
export const aLearner: Factory<LearnerFixture> = defineFactory(
  (scope, n): LearnerFixture => ({
    tenantId: scope.tenantId,
    token: `LNR_${scope.tenantId.slice(0, 6).toUpperCase()}_${String(n).padStart(4, '0')}`,
    homeLanguage: 'en',
    createdBy: scope.actorId,
  }),
);

export interface StaffFixture {
  tenantId: string;
  displayName: string;
  createdBy: string;
}

export const aStaffMember: Factory<StaffFixture> = defineFactory(
  (scope, n): StaffFixture => ({
    tenantId: scope.tenantId,
    displayName: `Test Teacher ${n}`,
    createdBy: scope.actorId,
  }),
);

/**
 * Runs `fn` against a fresh tenant scope.
 *
 * The test-side counterpart to the database package's `withTenant`. Using it means a test
 * cannot forget to establish a scope, which is the same guarantee the production client
 * gives production code.
 */
export async function withTenant<T>(
  fn: (scope: TenantScope) => Promise<T>,
  overrides: Partial<TenantScope> = {},
): Promise<T> {
  return fn(tenantScope(overrides));
}

export const PACKAGE_NAME = '@infinite-ai/testkit' as const;
