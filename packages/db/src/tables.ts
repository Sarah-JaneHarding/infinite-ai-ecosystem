// The tenancy classification of every table in the schema — Stage 01 exit gate.
//
// This list is what the RLS coverage test diffs against information_schema. Keeping it as
// data, in the package rather than in the test, means a new table in Stage 05 or 09 has to
// be classified deliberately: leave it out and the coverage test fails, because a table
// the schema knows about and this file does not is exactly the gap that lets tenancy rot.

/**
 * Tables carrying a `tenant_id` column, isolated by the standard policy.
 */
export const TENANT_OWNED_TABLES = [
  'academic_year',
  'audit_event',
  'class_group',
  'grade',
  'guardian',
  'guardian_link',
  'learner',
  'learner_identifier',
  'phase',
  'role_assignment',
  'school',
  'staff_member',
  'subject',
  'teaching_assignment',
  'tenant_setting',
  'term',
  'user_account',
] as const;

/**
 * Tables isolated by their own primary key rather than a foreign `tenant_id`.
 *
 * There is exactly one, and it is named rather than inferred. An inferred exemption —
 * "any table without a tenant_id column" — would silently absolve a table that simply
 * forgot the column, which is the failure mode this whole file guards against.
 */
export const SELF_KEYED_TENANT_TABLES = ['tenant'] as const;

/**
 * Tables legitimately outside tenancy.
 *
 * Prisma's own migration bookkeeping. Nothing application-owned belongs here, and adding
 * to this list should feel like it needs a justification, because it does.
 */
export const NON_TENANT_TABLES = ['_prisma_migrations'] as const;

export type TenantOwnedTable = (typeof TENANT_OWNED_TABLES)[number];
