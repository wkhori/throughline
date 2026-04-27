-- V3: Week + Commit (PRD §3.3 V3) + P18 reconcile-window columns folded into Org (P33).

-- P18: org-level reconcile window (default Friday 12:00 in org TZ).
ALTER TABLE org
  ADD COLUMN reconcile_opens_day_of_week varchar(10) NOT NULL DEFAULT 'FRIDAY',
  ADD COLUMN reconcile_opens_time        time        NOT NULL DEFAULT '12:00';

CREATE TABLE week (
  id            varchar(26) PRIMARY KEY,
  user_id       varchar(26) NOT NULL REFERENCES app_user(id),
  org_id        varchar(26) NOT NULL REFERENCES org(id),
  week_start    date NOT NULL,
  state         varchar(20) NOT NULL DEFAULT 'DRAFT'
                CHECK (state IN ('DRAFT','LOCKED','RECONCILING','RECONCILED')),
  locked_at     timestamptz,
  reconciled_at timestamptz,
  created_at    timestamptz NOT NULL,
  created_by    varchar(64),
  updated_at    timestamptz,
  updated_by    varchar(64),
  version       bigint NOT NULL DEFAULT 0,
  UNIQUE (user_id, week_start)
);

CREATE INDEX idx_week_user_state ON week(user_id, state);

-- `commit` is a reserved word in some SQL dialects; Postgres allows it as an identifier but we
-- quote it on every reference to keep the migration portable and unambiguous.
CREATE TABLE "commit" (
  id                       varchar(26) PRIMARY KEY,
  week_id                  varchar(26) NOT NULL REFERENCES week(id),
  text                     varchar(280) NOT NULL CHECK (length(text) >= 5),
  supporting_outcome_id    varchar(26) REFERENCES supporting_outcome(id),
  category                 varchar(20) NOT NULL DEFAULT 'OPERATIONAL'
                           CHECK (category IN ('STRATEGIC','OPERATIONAL','REACTIVE')),
  priority                 varchar(10) NOT NULL DEFAULT 'SHOULD'
                           CHECK (priority IN ('MUST','SHOULD','COULD')),
  display_order            int NOT NULL DEFAULT 0,
  state                    varchar(20) NOT NULL DEFAULT 'ACTIVE'
                           CHECK (state IN ('ACTIVE','CARRIED_FORWARD','DROPPED')),
  parent_commit_id         varchar(26) REFERENCES "commit"(id),
  reconciliation_outcome   varchar(10)
                           CHECK (reconciliation_outcome IN ('DONE','PARTIAL','NOT_DONE')),
  reconciliation_note      varchar(1000),
  carry_forward_weeks      int NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL,
  created_by               varchar(64),
  updated_at               timestamptz,
  updated_by               varchar(64),
  version                  bigint NOT NULL DEFAULT 0
);

CREATE INDEX idx_commit_week ON "commit"(week_id);
CREATE INDEX idx_commit_so_state ON "commit"(supporting_outcome_id, state);
CREATE INDEX idx_commit_parent ON "commit"(parent_commit_id);
