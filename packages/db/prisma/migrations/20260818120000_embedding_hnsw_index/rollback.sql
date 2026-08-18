-- Rollback for 20260818120000_embedding_hnsw_index.
--
-- Removes the HNSW index and drops the vector dimension constraint.
-- Run this only after verifying no existing data depends on the 1536-dimension guarantee.

DROP INDEX IF EXISTS brain_embedding_hnsw_idx;

-- Revert to a dimensionless vector column. Existing data is preserved.
ALTER TABLE brain_embedding
  ALTER COLUMN vector TYPE vector;
