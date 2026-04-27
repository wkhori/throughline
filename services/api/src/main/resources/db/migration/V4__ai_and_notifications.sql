-- V4 (Phase 5a): AI insight + notification + alignment-risk + AI budget + per-user-hour counter
-- (PRD §3.3 V4 / patches P3, P12, P13, P20, P23). Reserves V4 for the contiguous AI/notification
-- surface per P34 — the manager rollup cache landed in V5 ahead of this migration so that V4
-- could remain unbroken.
--
-- Patch P38 (this migration): the `idx_notif_digest_unique` partial unique index is bundled here
-- rather than waiting for Phase 6 — keeps the schema contiguous and lets Phase 5c's `T5` digest
-- delivery rely on database-level idempotency from day one.

-- ----------------------------------------------------------------------------
-- ai_insight: persisted AI output (audit trail + cache)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_insight (
  id                  varchar(26) PRIMARY KEY,
  org_id              varchar(26) NOT NULL REFERENCES org(id),
  kind                varchar(40) NOT NULL,
  entity_type         varchar(40) NOT NULL,
  entity_id           varchar(26) NOT NULL,
  model               varchar(80) NOT NULL,
  payload_json        jsonb NOT NULL,
  input_hash          varchar(64) NOT NULL,
  tokens_input        int NOT NULL DEFAULT 0,
  tokens_output       int NOT NULL DEFAULT 0,
  tokens_cache_read   int NOT NULL DEFAULT 0,
  latency_ms          int NOT NULL DEFAULT 0,
  cost_cents          numeric(8,4) NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL
);
CREATE INDEX idx_ai_entity ON ai_insight(entity_type, entity_id, kind, created_at DESC);
CREATE INDEX idx_ai_input_hash ON ai_insight(input_hash, created_at DESC);

-- ----------------------------------------------------------------------------
-- notification_event: outbound notification (audit + retry)
-- ----------------------------------------------------------------------------
CREATE TABLE notification_event (
  id            varchar(26) PRIMARY KEY,
  org_id        varchar(26) NOT NULL REFERENCES org(id),
  kind          varchar(40) NOT NULL,
  channel       varchar(20) NOT NULL,
  recipient_id  varchar(26) NOT NULL,
  payload_json  jsonb NOT NULL,
  state         varchar(30) NOT NULL DEFAULT 'PENDING'
                CHECK (state IN ('PENDING','SENT','FAILED','SKIPPED_DUPLICATE')),
  attempts      int NOT NULL DEFAULT 0,
  last_error    text,
  sent_at       timestamptz,
  created_at    timestamptz NOT NULL
);
CREATE INDEX idx_notif_state ON notification_event(state, created_at);

-- P20 / P38: digest idempotency at the database level. Bundled into V4 so Phase 5c's T5 delivery
-- benefits immediately; Phase 6 still wires the application-level guard but the index is the
-- source of truth.
CREATE UNIQUE INDEX idx_notif_digest_unique
  ON notification_event(recipient_id, kind, (payload_json->>'weekStart'))
  WHERE kind = 'WEEKLY_DIGEST' AND state IN ('SENT','PENDING');

-- ----------------------------------------------------------------------------
-- alignment_risk: materialized T6 alert with 7-day dedupe key (P5)
-- ----------------------------------------------------------------------------
CREATE TABLE alignment_risk (
  id              varchar(26) PRIMARY KEY,
  org_id          varchar(26) NOT NULL REFERENCES org(id),
  rule            varchar(40) NOT NULL,
  severity        varchar(10) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH')),
  entity_type     varchar(40) NOT NULL,
  entity_id       varchar(26) NOT NULL,
  week_start      date NOT NULL,
  ai_insight_id   varchar(26) REFERENCES ai_insight(id),
  acknowledged_at timestamptz,
  acknowledged_by varchar(26) REFERENCES app_user(id),
  dedupe_key      varchar(128) NOT NULL,
  created_at      timestamptz NOT NULL
);
CREATE INDEX idx_alignment_risk_dedup ON alignment_risk(dedupe_key, created_at DESC);
CREATE INDEX idx_alignment_risk_org_week ON alignment_risk(org_id, week_start);
CREATE INDEX idx_alignment_risk_open
  ON alignment_risk(org_id, created_at DESC)
  WHERE acknowledged_at IS NULL;

-- ----------------------------------------------------------------------------
-- ai_budget: org-level monthly cost guard (P3 — extends AbstractAuditingEntity, audit cols)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_budget (
  org_id              varchar(26) NOT NULL REFERENCES org(id),
  month_start         date NOT NULL,
  cost_cents_accrued  numeric(10,4) NOT NULL DEFAULT 0,
  soft_cap_cents      numeric(10,4) NOT NULL DEFAULT 25000,
  hard_cap_cents      numeric(10,4) NOT NULL DEFAULT 50000,
  created_at          timestamptz NOT NULL,
  created_by          varchar(64),
  updated_at          timestamptz,
  updated_by          varchar(64),
  version             bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, month_start)
);

-- ----------------------------------------------------------------------------
-- ai_user_hour_counter: per-user-per-hour AI rate limit audit row (P23)
-- ----------------------------------------------------------------------------
-- Caffeine in-memory bucket is the hot path; this table is the durable audit trail and a
-- crash-safety fallback. UPDATE…RETURNING-then-check is implemented in
-- AnthropicCostGuard.preflight().
CREATE TABLE ai_user_hour_counter (
  user_id      varchar(26) NOT NULL REFERENCES app_user(id),
  hour_start   timestamptz NOT NULL,
  kind         varchar(20) NOT NULL,
  call_count   int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, hour_start, kind)
);
CREATE INDEX idx_ai_user_hour_user ON ai_user_hour_counter(user_id, hour_start DESC);
