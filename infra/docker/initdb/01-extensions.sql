-- Stage 01 step 1 — extensions.
--
-- Runs once, on an empty data directory, as the superuser the container bootstraps with.
-- Extensions are installed here rather than in a Prisma migration because CREATE
-- EXTENSION requires privileges the `migrator` role deliberately does not hold.
--
--   vector    pgvector — L1 semantic embeddings with HNSW indexes (Stage 05)
--   pg_trgm   trigram matching — fuzzy duplicate detection in the warehouse (Stage 09)
--   pgcrypto  gen_random_uuid() and digest() for the audit ledger's hash chain (Stage 02)
--
-- Note that pgcrypto is NOT what encrypts learner identifiers. §1.3 requires
-- application-level encryption for special personal information, so that key material
-- never reaches the database server. See packages/db/src/encryption.ts.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
