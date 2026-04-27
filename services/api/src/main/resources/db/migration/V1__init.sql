-- V1: org, team, app_user (auth + tenancy + manager hierarchy).
-- Audit columns on every entity per CLAUDE.md / docs/architecture-decisions.md row 16.

CREATE TABLE org (
  id              varchar(26) PRIMARY KEY,
  name            varchar(200) NOT NULL,
  timezone        varchar(64) NOT NULL DEFAULT 'America/New_York',
  week_start_day  varchar(10) NOT NULL DEFAULT 'MONDAY',
  created_at      timestamptz NOT NULL,
  created_by      varchar(64),
  updated_at      timestamptz,
  updated_by      varchar(64),
  version         bigint NOT NULL DEFAULT 0
);

CREATE TABLE team (
  id          varchar(26) PRIMARY KEY,
  org_id      varchar(26) NOT NULL REFERENCES org(id),
  name        varchar(200) NOT NULL,
  manager_id  varchar(26),
  created_at  timestamptz NOT NULL,
  created_by  varchar(64),
  updated_at  timestamptz,
  updated_by  varchar(64),
  version     bigint NOT NULL DEFAULT 0
);

CREATE TABLE app_user (
  id            varchar(26) PRIMARY KEY,
  org_id        varchar(26) NOT NULL REFERENCES org(id),
  team_id       varchar(26) REFERENCES team(id),
  auth0_sub     varchar(128) NOT NULL UNIQUE,
  email         varchar(320) NOT NULL,
  display_name  varchar(200) NOT NULL,
  role          varchar(20) NOT NULL CHECK (role IN ('IC','MANAGER','ADMIN')),
  manager_id    varchar(26) REFERENCES app_user(id),
  created_at    timestamptz NOT NULL,
  created_by    varchar(64),
  updated_at    timestamptz,
  updated_by    varchar(64),
  version       bigint NOT NULL DEFAULT 0
);

ALTER TABLE team ADD CONSTRAINT fk_team_manager FOREIGN KEY (manager_id) REFERENCES app_user(id);

CREATE INDEX idx_user_manager ON app_user(manager_id);
CREATE INDEX idx_user_org_role ON app_user(org_id, role);
