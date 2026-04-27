-- V5 (Phase 4): per-team manager rollup cache (PRD §3.3 / P10 / P25).
--
-- Note on numbering: V4 is reserved for Phase 5a's `ai_*` + `notification_event` +
-- `alignment_risk` + `ai_budget` + `ai_user_hour_counter` tables (PRD §3.3 V4). Phase 4 jumps
-- straight to V5 so V4 stays available for the AI surface to land contiguously without a
-- baseline-on-migrate gap.
--
-- The cache is recomputed by `MaterializedRollupJob`:
--   1. on every `WeekReconciledEvent` (AFTER_COMMIT) — keeps the dashboard fresh in real time.
--   2. on a `@Scheduled` cron 30 minutes before the Monday digest cron — guarantees the digest
--      reads a warm cache.
--
-- `payload_json` schema (computed by `MaterializedRollupJob.computePayload`):
--   {
--     "teamId": ulid,
--     "teamName": string,
--     "weekStart": iso-date,
--     "memberCount": int,
--     "lockedCount": int,
--     "reconciledCount": int,
--     "doneCount": int,
--     "partialCount": int,
--     "notDoneCount": int,
--     "carryForwardCount": int,
--     "commitsByOutcome": [ { outcomeId, outcomeTitle, share } ],
--     "starvedOutcomes": [ { outcomeId, outcomeTitle, weeksStarved } ],
--     "driftExceptions": [ { rallyCryId, rallyCryTitle, observedShare, expectedLow, expectedHigh } ],
--     "exceptionRibbon":  [ { kind, severity, label, entityType, entityId } ]
--   }
CREATE TABLE team_rollup_cache (
  team_id      varchar(26) NOT NULL REFERENCES team(id),
  week_start   date        NOT NULL,
  payload_json jsonb       NOT NULL,
  computed_at  timestamptz NOT NULL,
  PRIMARY KEY (team_id, week_start)
);

CREATE INDEX idx_team_rollup_cache_computed_at ON team_rollup_cache(computed_at DESC);
