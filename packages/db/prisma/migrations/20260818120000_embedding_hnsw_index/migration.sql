-- Embedding model selection — Stage 08 P0.3.
--
-- Standardises brain_embedding.vector to 1536 dimensions (text-embedding-3-small /
-- text-embedding-3-large with dimensions=1536) and builds an HNSW index for cosine
-- similarity search. The dimension is fixed at the schema level so incompatible embeddings
-- fail loudly at INSERT time rather than silently degrading retrieval quality.
--
-- Model choice recorded here: text-embedding-3-small (OpenAI) as primary,
-- nomic-embed-text must be called with output_dimensionality=1536 as local fallback.
-- Both are recorded in docs/DEPENDENCIES.md (Stage 08 P0).
--
-- Rollback: see rollback.sql in this directory.

-- 1. Fix the vector dimension. Empty table on fresh deployments so this is non-destructive.
--    On a live deployment with existing data, a prior maintenance window must verify all
--    existing vectors are 1536-dimensional before applying this constraint.
ALTER TABLE brain_embedding
  ALTER COLUMN vector TYPE vector(1536);

-- 2. HNSW index — m=16 and ef_construction=64 are the pgvector defaults; adequate for
--    typical school-sized corpora (< 10M nodes). Adjust via a separate migration once load
--    characteristics are measured (Stage 16 supply-chain review is the natural moment).
--    CONCURRENTLY keeps the table readable during index build on a live deployment;
--    it is a no-op on a fresh schema.
CREATE INDEX IF NOT EXISTS brain_embedding_hnsw_idx
  ON brain_embedding USING hnsw (vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
