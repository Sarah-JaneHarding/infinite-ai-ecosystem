-- OQ-033 — close a NULL gap in the invitation's roles CHECK.
--
-- "user_invitation_roles_school_staff" (migration 20261024090000) was written as
--     CHECK (cardinality("roles") >= 1 AND "roles" <@ ARRAY['teacher', …]::text[])
-- The column is nullable — Prisma generates list columns as plain TEXT[] — and a CHECK that
-- evaluates to NULL passes. With "roles" NULL, cardinality("roles") is NULL, the whole expression is
-- NULL, and the row is accepted: the very thing the constraint exists to refuse ("no platform role
-- can ever be invited, whoever writes the row") was not true for a NULL. Nothing in the application
-- writes a NULL (Prisma lists default to empty, which the CHECK refuses), so the exposure was a
-- hand-written insert only. Reproduced in a local PostgreSQL 16 before this was written.
--
-- The constraint is dropped and re-added with the same two tests plus an explicit IS NOT NULL, in one
-- transaction (Prisma runs each migration in one), so there is no moment without it. If an existing
-- row had a NULL "roles" the ADD would fail and this migration would stop rather than repair data;
-- no code path creates one, and silently rewriting an invitation would be worse than failing.
--
-- No tenant context is needed: a CHECK is validated by a direct scan of this table, not through a
-- foreign key to a table under FORCE ROW LEVEL SECURITY (the 42704 case the other OQ-033 migrations
-- guard against). The table is small and the lock brief.

ALTER TABLE "user_invitation" DROP CONSTRAINT "user_invitation_roles_school_staff";

ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_roles_school_staff"
    CHECK ("roles" IS NOT NULL
       AND cardinality("roles") >= 1
       AND "roles" <@ ARRAY['teacher', 'hod', 'smt', 'sbst', 'admin']::text[]);
