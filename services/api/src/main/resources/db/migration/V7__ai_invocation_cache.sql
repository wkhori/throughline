-- V7: persistent, content-keyed AI invocation cache.
--
-- Extends the existing ai_insight table with a cache_key column so a (modelVersion, kind, canonical
-- input) tuple maps to a single row across sessions. The 60-second input_hash dedupe in
-- AIInsightCache is preserved as a defense-in-depth layer; cache_key lookup runs first.
--
-- The hot lookup index serves the batch hydration endpoint that returns the latest insight per
-- (commit, kind) tuple. The partial unique index keeps cache rows globally unique on
-- (cache_key, kind) while exempting historical rows whose cache_key is NULL.

ALTER TABLE ai_insight ADD COLUMN cache_key varchar(64);

CREATE INDEX idx_ai_insight_commit_kind
  ON ai_insight(entity_id, kind, created_at DESC)
  WHERE entity_type = 'commit';

CREATE UNIQUE INDEX idx_ai_insight_cache_unique
  ON ai_insight(cache_key, kind)
  WHERE cache_key IS NOT NULL;
