-- OQ-033 step 7c — has the identity provider been told? (docs/PROVISIONING_DESIGN.md §11.1)
--
-- The database is the authority for who holds which role (§4.4); Keycloak is told afterwards, because a
-- network call must not share the provisioning transaction. This is the record that makes a failed
-- or interrupted "telling" visible and retryable instead of silent.
--
--   NOT_MANAGED  the application never touches this person's Keycloak user (the by-hand pilot path, and
--                every row that existed before this migration). The default, so nothing changes until a
--                row is deliberately opted in.
--   PENDING      the database has changed in a way Keycloak has not been told about yet. Set in the SAME
--                transaction as the change, so a crash before the call leaves a visible marker.
--   SYNCED       Keycloak matches the database as of the last reconcile.
--   FAILED       the last attempt failed; `idp_error_kind` says only how (never a response body or an
--                address, which an upstream error can carry).
--
-- An invitation also records the Keycloak user id it created (`idp_user_id`), so a retry after a half
-- finished attempt finds that user instead of failing on "already exists". An account needs none: its
-- OIDC `subject` IS the Keycloak user id.
--
-- Adds columns with defaults and two CHECKs that every existing row satisfies; no row is rewritten
-- beyond the default. Each CHECK is a boolean that cannot evaluate to NULL (the NOT NULL columns are
-- compared, the nullable ones tested with IS [NOT] NULL), so none of them can pass by being NULL.
--
-- Rollback: rollback.sql in this directory.

CREATE TYPE "idp_state" AS ENUM ('NOT_MANAGED', 'PENDING', 'SYNCED', 'FAILED');

ALTER TABLE "user_invitation"
    ADD COLUMN "idp_state"      "idp_state" NOT NULL DEFAULT 'NOT_MANAGED',
    ADD COLUMN "idp_user_id"    TEXT,
    ADD COLUMN "idp_error_kind" TEXT;

ALTER TABLE "user_account"
    ADD COLUMN "idp_state"      "idp_state" NOT NULL DEFAULT 'NOT_MANAGED',
    ADD COLUMN "idp_error_kind" TEXT;

-- An error kind exists exactly when the state is FAILED; a SYNCED invitation names its Keycloak user; an
-- unmanaged one has none.
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_idp_consistent"
    CHECK (("idp_state" = 'FAILED') = ("idp_error_kind" IS NOT NULL)
       AND ("idp_state" <> 'SYNCED' OR "idp_user_id" IS NOT NULL)
       AND ("idp_state" <> 'NOT_MANAGED' OR "idp_user_id" IS NULL));

ALTER TABLE "user_account" ADD CONSTRAINT "user_account_idp_consistent"
    CHECK (("idp_state" = 'FAILED') = ("idp_error_kind" IS NOT NULL));
