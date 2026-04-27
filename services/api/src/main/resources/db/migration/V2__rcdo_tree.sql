-- V2: RCDO graph (Rally Cry → Defining Objective → Outcome → Supporting Outcome)
--     + team priority weights at RC granularity (P4).

CREATE TABLE rally_cry (
  id            varchar(26) PRIMARY KEY,
  org_id        varchar(26) NOT NULL REFERENCES org(id),
  title         varchar(500) NOT NULL,
  description   text,
  display_order int NOT NULL DEFAULT 0,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL,
  created_by    varchar(64),
  updated_at    timestamptz,
  updated_by    varchar(64),
  version       bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_rally_cry_org_title_active
  ON rally_cry(org_id, title)
  WHERE archived_at IS NULL;

CREATE TABLE defining_objective (
  id              varchar(26) PRIMARY KEY,
  rally_cry_id    varchar(26) NOT NULL REFERENCES rally_cry(id),
  title           varchar(500) NOT NULL,
  description     text,
  display_order   int NOT NULL DEFAULT 0,
  archived_at     timestamptz,
  created_at      timestamptz NOT NULL,
  created_by      varchar(64),
  updated_at      timestamptz,
  updated_by      varchar(64),
  version         bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_do_rc_title_active
  ON defining_objective(rally_cry_id, title)
  WHERE archived_at IS NULL;
CREATE INDEX idx_do_rc ON defining_objective(rally_cry_id) WHERE archived_at IS NULL;

CREATE TABLE outcome (
  id                       varchar(26) PRIMARY KEY,
  defining_objective_id    varchar(26) NOT NULL REFERENCES defining_objective(id),
  title                    varchar(500) NOT NULL,
  description              text,
  metric_statement         text,
  display_order            int NOT NULL DEFAULT 0,
  archived_at              timestamptz,
  created_at               timestamptz NOT NULL,
  created_by               varchar(64),
  updated_at               timestamptz,
  updated_by               varchar(64),
  version                  bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_outcome_do_title_active
  ON outcome(defining_objective_id, title)
  WHERE archived_at IS NULL;
CREATE INDEX idx_outcome_do ON outcome(defining_objective_id) WHERE archived_at IS NULL;

CREATE TABLE supporting_outcome (
  id            varchar(26) PRIMARY KEY,
  outcome_id    varchar(26) NOT NULL REFERENCES outcome(id),
  title         varchar(500) NOT NULL,
  description   text,
  display_order int NOT NULL DEFAULT 0,
  archived_at   timestamptz,
  created_at    timestamptz NOT NULL,
  created_by    varchar(64),
  updated_at    timestamptz,
  updated_by    varchar(64),
  version       bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX uq_so_outcome_title_active
  ON supporting_outcome(outcome_id, title)
  WHERE archived_at IS NULL;
CREATE INDEX idx_so_outcome ON supporting_outcome(outcome_id) WHERE archived_at IS NULL;

CREATE TABLE team_priority_weight (
  id                   varchar(26) PRIMARY KEY,
  team_id              varchar(26) NOT NULL REFERENCES team(id),
  rally_cry_id         varchar(26) NOT NULL REFERENCES rally_cry(id),
  expected_share_low   numeric(4,3) NOT NULL CHECK (expected_share_low >= 0 AND expected_share_low <= 1),
  expected_share_high  numeric(4,3) NOT NULL CHECK (expected_share_high >= 0 AND expected_share_high <= 1),
  created_at           timestamptz NOT NULL,
  created_by           varchar(64),
  updated_at           timestamptz,
  updated_by           varchar(64),
  version              bigint NOT NULL DEFAULT 0,
  UNIQUE (team_id, rally_cry_id),
  CHECK (expected_share_high >= expected_share_low)
);
