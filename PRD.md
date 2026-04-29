# PRD — Weekly Commit Module

> **How to read this document.** This PRD is a build script. It enforces SDD (every feature begins with Gherkin) and TDD (every backend endpoint begins with a contract test, every component begins with a Vitest test list). Phases are ordered so each is shippable and testable in isolation. Companion docs: `project-brief.md` (the original brief, verbatim), `CLAUDE.md` (methodology, the Rule, manager-burden reframe), `docs/architecture-decisions.md` (33-row requirement-treatment table — every decision is final).

---

## 1. Executive Summary

**What we're building.** A production-ready micro-frontend that replaces 15Five for weekly planning. Every weekly commit (a sentence-length work item written by an IC) is FK-linked to a Supporting Outcome inside the org's RCDO hierarchy (Rally Cry → Defining Objective → Outcome → Supporting Outcome). The system enforces a complete weekly lifecycle — `DRAFT → LOCKED → RECONCILING → RECONCILED → CARRIED_FORWARD` — and surfaces an AI **Strategic Alignment Copilot** at every transition.

**Manager-burden reduction is the design spine.** The IC + AI copilot do the alignment work as a natural byproduct of planning. The manager's default view is a pre-digested AI dashboard. They drill in only on flagged exceptions. Every feature is judged against: *does this reduce required manager attention without losing signal?*

**Differentiation vs. 15Five.** 15Five operates on unstructured check-in text. We operate on a structured RCDO graph. Our AI generates insights 15Five structurally cannot — *"Outcome 3.2 received zero commits org-wide for two weeks running"*, *"this commit has been carry-forwarded four weeks running"*, *"Sarah's portfolio is 71% concentrated on a single Outcome while team priority signal expects 30–50% on enterprise"*.

---

## 2. Locked Inputs (Binding)

- `project-brief.md` — original brief.
- `CLAUDE.md` — methodology, the Rule, lifecycle and AI canonical references.
- `docs/architecture-decisions.md` — 33-row requirement-treatment table. **Every decision is final.** Two substitutions only: AWS → Railway + Terraform skeleton; Outlook Graph → Slack via channel-adapter pattern with stubbed Graph impl. Playwright is out of scope (Cypress + Cucumber/Gherkin only).
- `docs/ai-copilot-spec.md` — full text of the 6 AI prompts, schemas, fallbacks, evals.
- `docs/prd-patches.md` — **26 patches from Loop 5 gap check.** 10 critical patches are applied inline below; 12 important patches are scoped per phase; 4 minor patches are queued. The implementing agent reads this document at the start of every phase.

If any tension surfaces between this PRD and the locked inputs, the locked inputs win.

---

## 3. Domain Model

### 3.1 Entities

All entities extend `AbstractAuditingEntity` (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `version`). Primary keys are ULIDs (26-char Crockford base32) stored as `varchar(26)` for sortable, URL-safe identifiers.

| Entity | Purpose | Key fields |
|---|---|---|
| `Org` | Multi-tenant root | `id`, `name`, `timezone` (e.g. `America/New_York`), `weekStartDay` (default `MONDAY`) |
| `User` | Auth0-authenticated user | `id`, `orgId`, `auth0Sub` (unique), `email`, `displayName`, `role` (`IC`/`MANAGER`/`ADMIN`), `managerId` (self-FK, nullable), `teamId`. **Role hierarchy:** `ADMIN > MANAGER > IC` — a manager and admin implicitly have IC capability for their own user_id. |
| `Team` | Org subdivision | `id`, `orgId`, `name`, `managerId` |
| `RallyCry` | Top of RCDO tree | `id`, `orgId`, `title` (≤500), `description`, `displayOrder`, `archivedAt` (nullable) |
| `DefiningObjective` | DO under RC | `id`, `rallyCryId`, `title`, `description`, `displayOrder`, `archivedAt` |
| `Outcome` | Outcome under DO | `id`, `definingObjectiveId`, `title`, `description`, `metricStatement`, `displayOrder`, `archivedAt` |
| `SupportingOutcome` | Leaf of RCDO; commit FK target | `id`, `outcomeId`, `title`, `description`, `displayOrder`, `archivedAt` |
| `Week` | One IC's week instance | `id`, `userId`, `orgId`, `weekStart` (DATE, UTC), `state` (`DRAFT`/`LOCKED`/`RECONCILING`/`RECONCILED`), `lockedAt`, `reconciledAt` |
| `Commit` | Weekly commitment | `id`, `weekId`, `text` (5–280 chars), `supportingOutcomeId` (nullable until lock), `category` (`STRATEGIC`/`OPERATIONAL`/`REACTIVE`), `priority` (`MUST`/`SHOULD`/`COULD`), `displayOrder`, `state` (`ACTIVE`/`CARRIED_FORWARD`/`DROPPED`), `parentCommitId` (self-FK for carry-forward lineage), `reconciliationOutcome` (`DONE`/`PARTIAL`/`NOT_DONE`, nullable), `reconciliationNote` (≤1000 chars), `carryForwardWeeks` (denormalized counter, computed at reconcile time) |
| `TeamPriorityWeight` | Manager-set per-team RCDO weight signal | `id`, `teamId`, `rallyCryId`, `expectedShareLow` (0–1), `expectedShareHigh` (0–1) |
| `AIInsight` | Persisted AI output (audit trail + cache) | `id`, `kind` (`T1_SUGGESTION`/`T2_DRIFT`/`T3_PORTFOLIO`/`T4_DELTA`/`T5_DIGEST`/`T6_ALERT`), `entityType`, `entityId`, `model`, `payloadJson` (jsonb), `inputHash`, `tokensInput`, `tokensOutput`, `tokensCacheRead`, `latencyMs`, `costCents`, `createdAt` |
| `NotificationEvent` | Outbound notification (audit + retry) | `id`, `kind` (`WEEKLY_DIGEST`/`ALIGNMENT_RISK`/`LOCK_CONFIRM`/`RECONCILE_REMINDER`), `channel` (`SLACK`/`OUTLOOK`/`LOG`), `recipientId`, `payloadJson`, `state` (`PENDING`/`SENT`/`FAILED`/`SKIPPED_DUPLICATE`), `attempts`, `lastError`, `sentAt` |
| `AlignmentRisk` | Materialized alert from T6 | `id`, `rule` (`LONG_CARRY_FORWARD`/`STARVED_OUTCOME`/`SINGLE_OUTCOME_CONCENTRATION`), `severity` (`LOW`/`MEDIUM`/`HIGH`), `entityType`, `entityId`, `weekStart`, `aiInsightId` (FK), `acknowledgedAt`, `dedupeKey` |
| `AIBudget` | Org-level cost guard (extends `AbstractAuditingEntity`) | `orgId`, `monthStart`, `costCentsAccrued`, `softCapCents`, `hardCapCents`, audit columns |

### 3.2 Indexes

- `Commit (week_id)`, `Commit (supporting_outcome_id, state)`, `Commit (parent_commit_id)`
- `Week (user_id, week_start)` UNIQUE — enforces one week per user per week.
- `User (auth0_sub)` UNIQUE
- `User (org_id, role)` — for role queries
- `User (manager_id)` — for team rollup
- `AIInsight (entity_type, entity_id, kind, created_at DESC)` — most-recent lookup
- `AlignmentRisk (dedupe_key, created_at)` — 7-day dedup
- `NotificationEvent (state, created_at)` — retry scanning

### 3.3 Flyway Migrations

Location: `services/api/src/main/resources/db/migration/`. All migrations include foreign-key constraints with `ON DELETE` semantics chosen per relationship (RCDO archival is soft; commit→supporting-outcome stays referential even after archive).

#### `V1__init.sql`

```sql
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
```

#### `V2__rcdo_tree.sql`

```sql
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
  version       bigint NOT NULL DEFAULT 0,
  UNIQUE (org_id, title) WHERE archived_at IS NULL
);

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
  version         bigint NOT NULL DEFAULT 0,
  UNIQUE (rally_cry_id, title) WHERE archived_at IS NULL
);

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
  version                  bigint NOT NULL DEFAULT 0,
  UNIQUE (defining_objective_id, title) WHERE archived_at IS NULL
);

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
  version       bigint NOT NULL DEFAULT 0,
  UNIQUE (outcome_id, title) WHERE archived_at IS NULL
);

CREATE INDEX idx_so_outcome ON supporting_outcome(outcome_id) WHERE archived_at IS NULL;
CREATE INDEX idx_outcome_do ON outcome(defining_objective_id) WHERE archived_at IS NULL;
CREATE INDEX idx_do_rc ON defining_objective(rally_cry_id) WHERE archived_at IS NULL;

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
```

#### `V3__commits.sql`

```sql
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

CREATE TABLE commit (
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
  parent_commit_id         varchar(26) REFERENCES commit(id),
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

CREATE INDEX idx_commit_week ON commit(week_id);
CREATE INDEX idx_commit_so_state ON commit(supporting_outcome_id, state);
CREATE INDEX idx_commit_parent ON commit(parent_commit_id);
```

#### `V4__ai_and_notifications.sql`

```sql
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
  dedupe_key      varchar(128) NOT NULL,
  created_at      timestamptz NOT NULL
);
CREATE INDEX idx_alignment_risk_dedup ON alignment_risk(dedupe_key, created_at);
CREATE INDEX idx_alignment_risk_org_week ON alignment_risk(org_id, week_start);

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

-- Per-user-per-hour AI rate limit (P23) — Caffeine cache backs this; table is for audit
CREATE TABLE ai_user_hour_counter (
  user_id      varchar(26) NOT NULL REFERENCES app_user(id),
  hour_start   timestamptz NOT NULL,
  kind         varchar(20) NOT NULL,
  call_count   int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, hour_start, kind)
);

-- Manager team rollup cache (P10/P25) — backs the <200ms perf gate
CREATE TABLE team_rollup_cache (
  team_id      varchar(26) NOT NULL REFERENCES team(id),
  week_start   date NOT NULL,
  payload_json jsonb NOT NULL,
  computed_at  timestamptz NOT NULL,
  PRIMARY KEY (team_id, week_start)
);

-- Digest idempotency (P20)
CREATE UNIQUE INDEX idx_notif_digest_unique
  ON notification_event(recipient_id, kind, (payload_json->>'weekStart'))
  WHERE kind = 'WEEKLY_DIGEST' AND state IN ('SENT','PENDING');
```

#### `R__seed_demo.sql` (dev profile only — see §11 Seed Data)

---

## 4. API Contracts

All endpoints prefixed with `/api/v1`. Auth via `Authorization: Bearer <jwt>`. Errors return RFC-7807 problem JSON. Pagination via Spring `Pageable` (`?page=&size=&sort=`). RTK Query slices live in `apps/weekly-commit-remote/src/api/endpoints/`.

### 4.1 Endpoint inventory

| Group | Method | Path | Auth | RTK tag |
|---|---|---|---|---|
| Auth | GET | `/me` | any auth | — |
| RCDO | GET | `/rcdo/tree` | any | `RcdoTree` |
| RCDO admin | POST | `/admin/rally-cries` | ADMIN | `RcdoTree` |
| RCDO admin | PUT | `/admin/rally-cries/{id}` | ADMIN | `RcdoTree` |
| RCDO admin | DELETE | `/admin/rally-cries/{id}` | ADMIN | `RcdoTree` |
| RCDO admin | POST | `/admin/defining-objectives` | ADMIN | `RcdoTree` |
| RCDO admin | POST | `/admin/outcomes` | ADMIN | `RcdoTree` |
| RCDO admin | POST | `/admin/supporting-outcomes` | ADMIN | `RcdoTree` |
| RCDO admin | DELETE | `/admin/supporting-outcomes/{id}` | ADMIN | `RcdoTree` |
| Week | GET | `/weeks/current` | IC/M/A | `Week`, `Commit` |
| Week | GET | `/weeks/{id}` | IC/M/A | `Week`, `Commit` |
| Week | POST | `/weeks/{id}/lock` | owner | `Week`, `Commit`, `AIInsight` |
| Week | POST | `/weeks/{id}/reconcile-start` | owner | `Week` |
| Week | PUT | `/weeks/{id}/reconcile` | owner | `Week`, `Commit`, `AIInsight` |
| Commit | POST | `/commits` | owner | `Commit` |
| Commit | PUT | `/commits/{id}` | owner | `Commit` |
| Commit | DELETE | `/commits/{id}` | owner | `Commit` |
| Commit | POST | `/commits/{id}/carry-forward` | owner | `Commit`, `Week` |
| AI | POST | `/ai/suggest-outcome` | IC | `AIInsight` (cache only) |
| AI | POST | `/ai/drift-check` | IC | — |
| AI | GET | `/ai/portfolio-review/{weekId}` | owner/M | `AIInsight` |
| AI | GET | `/ai/alignment-delta/{weekId}` | owner/M | `AIInsight` |
| Manager | GET | `/manager/team-rollup` | MANAGER (scope) | `TeamRollup` |
| Manager | GET | `/manager/team/{userId}/week/current` | MANAGER (scope) | `Week`, `Commit` |
| Manager | GET | `/manager/digest/current` | MANAGER (scope) | `AIInsight` |
| Manager | POST | `/manager/digest/regenerate` | MANAGER (scope) | `AIInsight` |
| Manager | GET | `/manager/alignment-risks` | MANAGER (scope) | `AlignmentRisk` |
| Manager | POST | `/manager/alignment-risks/{id}/ack` | MANAGER (scope) | `AlignmentRisk` |
| AI | GET | `/ai/portfolio-review/{weekId}` | owner/M (scope) | `AIInsight` |
| AI | GET | `/ai/alignment-delta/{weekId}` | owner/M (scope) | `AIInsight` |
| Metrics | GET | `/metrics/org` | ADMIN | — |
| Notifications | POST | `/notifications/digest/run` | system/cron | `Notification` |

### 4.2 Sample contract (lock week)

**`POST /api/v1/weeks/{id}/lock`** — owner only.

Request: `{}` (idempotent on already-LOCKED).

Responses:
- `200 OK` — body: `{ week: WeekDto, portfolioReview: AIInsightDto | null }`. Synchronous if AI returned within 8s; otherwise `portfolioReview: null` and the client subscribes to a websocket channel `ws/insights/{weekId}`.
- `400` — empty week or any commit missing `supportingOutcomeId`. Body: `{ type, title: "VALIDATION_ERROR", errors: [{field, message}] }`.
- `401` — no JWT.
- `403` — non-owner.
- `404` — unknown week.
- `409` — illegal state (already locked, or in RECONCILING/RECONCILED). Body: `{ type, title: "ILLEGAL_STATE", currentState, attempted }`.

### 4.3 Reconcile contract

**`PUT /api/v1/weeks/{id}/reconcile`** — owner only. Body:

```json
{
  "items": [
    { "commitId": "01H...", "outcome": "DONE|PARTIAL|NOT_DONE", "note": "...", "carryForward": false }
  ]
}
```

Validations:
- Every commit in the week must have an entry.
- `note` ≤ 1000 chars.
- `carryForward` only legal when `outcome ∈ {PARTIAL, NOT_DONE}`.
- Carry-forward fails with `409` if next week is at the 7-commit cap.

Side effects: state → `RECONCILED`, spawn `parentCommitId`-linked DRAFTs, fire AI alignment-delta call, persist `AIInsight`.

### 4.3a Authorization scope (P9, P15)

Every endpoint marked **(scope)** requires the caller to be in scope for the target user. Implemented via `@PreAuthorize("@managerScope.canSee(#userId, principal)")` on controller methods. `ManagerScope` walks the `User.managerId` chain — a manager can see direct or transitive reports; ADMIN bypasses the check; the user themselves always passes.

For `/ai/portfolio-review/{weekId}` and `/ai/alignment-delta/{weekId}`, the check resolves `Week.userId` from the `weekId` param first. Calls referring to weeks outside the caller's scope return 403.

### 4.4 RTK Query tag invalidation

```ts
export enum TagTypes {
  Week = 'Week',
  Commit = 'Commit',
  RcdoTree = 'RcdoTree',
  TeamRollup = 'TeamRollup',
  AIInsight = 'AIInsight',
  AlignmentRisk = 'AlignmentRisk',
  Notification = 'Notification',
  User = 'User',
}
```

Mutations declare `invalidatesTags`; no manual cache writes anywhere in app code. CI lint rule `no-restricted-syntax` blocks `fetch(`, `axios.`, and direct cache mutations outside RTK Query.

---

## 5. Lifecycle State Machine

States: `DRAFT`, `LOCKED`, `RECONCILING`, `RECONCILED`. Per-commit terminal: `CARRIED_FORWARD`. Implemented as a Spring `@Service` (`WeekStateMachine`) with guard methods; transitions go through this service exclusively (no direct state writes from controllers).

### 5.1 Transition table

| From | Event | Guards | To | Side effects |
|---|---|---|---|---|
| (none) | `getCurrentWeek` first visit | resolves week start in org TZ | `DRAFT` | INSERT week row |
| `DRAFT` | `addCommit` | week count < 7; commit validations | `DRAFT` | INSERT commit |
| `DRAFT` | `editCommit` | commit belongs to week | `DRAFT` | UPDATE commit |
| `DRAFT` | `lock` | ≥1 commit; every commit has SO | `LOCKED` | UPDATE week.state, week.lockedAt; emit `WeekLockedEvent`; call T3; persist AIInsight; cache T3 result |
| `LOCKED` | `editCommit`, `addCommit`, `delete` | — | reject 409 ILLEGAL_STATE | — |
| `LOCKED` | `reconcileStart` | week-end ≤ now (org TZ); user is owner | `RECONCILING` | UPDATE week.state |
| `RECONCILING` | `submitReconcile` | all commits have outcome; notes ≤1000 | `RECONCILED` | UPDATE week.state, week.reconciledAt; per-commit UPDATE; spawn carry-forward DRAFTs; emit `WeekReconciledEvent`; call T4; persist AIInsight |
| `RECONCILED` | any edit | — | reject 409 ILLEGAL_STATE | — |
| any | `carryForward` (per commit) | only at reconcile time; outcome is PARTIAL or NOT_DONE; next week not at cap | original commit → `CARRIED_FORWARD`; spawn new commit | INSERT new commit with `parentCommitId`, increment `carry_forward_weeks` |

### 5.2 Carry-forward semantics

- The original commit transitions to terminal `CARRIED_FORWARD`. It is no longer mutable.
- A new `Commit` is inserted in week N+1 (creating that week as `DRAFT` if it doesn't exist).
- `parentCommitId` chains preserve full lineage; the `carry_forward_weeks` counter on the new commit equals `parent.carry_forward_weeks + 1`.
- The 7-commit-per-week cap applies; carry-forward into a full next week returns `409`.
- Lineage queries: `WITH RECURSIVE` CTE walks `parent_commit_id`.

### 5.3 Concurrency & idempotency

- Optimistic locking via `@Version` on every mutable entity.
- Lock and reconcile mutations are idempotent on terminal state (replay returns 200 with the existing snapshot rather than error).
- AI calls deduped via `inputHash` — same input within 60s returns the cached `AIInsight` row instead of a new API call.

---

## 6. AI Strategic Alignment Copilot

Provider: Anthropic. Models: **`claude-haiku-4-5-20251001`** for high-volume cheap tasks, **`claude-sonnet-4-6`** for analytical work. Verified pricing (April 2026): Haiku $1/$5 per 1M in/out, Sonnet $3/$15 per 1M in/out, prompt-cache read at 0.10× base input.

> **Source of detail.** The complete prompt text, JSON schemas, fallback behavior, eval scenarios, and per-call cost math for all six touchpoints live in `docs/ai-copilot-spec.md` (generated alongside this PRD). The summary below is canonical; the spec is the implementable detail.

### 6.1 Touchpoints

| ID | Trigger | Model | Cost/call | Output |
|---|---|---|---|---|
| **T1 Outcome Suggestion** | DRAFT — IC types commit text (debounced 800ms, ≥15 chars) | Haiku | ~0.06¢ | `{ supportingOutcomeId, confidence, rationale, reasoning, model }` |
| **T2 Drift Warning** | DRAFT — commit text edit after SO link, debounced 1.5s | Haiku | ~0.09¢ | `{ driftScore, alignmentVerdict, fixSuggestion, suggestedRelink, reasoning, model }` |
| **T3 Portfolio Review** | LOCKED transition (sync ≤8s, async fallback) | Sonnet | ~1.4¢ | `{ headline, overallSeverity, findings[], chessGridSummary, reasoning, model }` |
| **T4 Alignment Delta** | RECONCILED transition (sync ≤10s, async fallback) | Sonnet | ~2.0¢ | `{ shipped[], slipped[], carryForwardRecommendations[], outcomeTractionDelta[], summary, reasoning, model }` |
| **T5 Manager Digest** | Cron Friday 16:00 manager-tz + on-demand (≤2/day) | Sonnet | ~3.2¢ | `{ alignmentHeadline, starvedOutcomes[], driftExceptions[], longCarryForwards[], drillDowns[], slackMessage, reasoning, model }` |
| **T6 Alignment-Risk Alert** | Hourly background scan; rule-driven | Haiku | ~0.13¢ | `{ severity, finding, suggestedAction, affectedEntities[], reasoning, model }` |
| **T7 Commit Quality Lint** | DRAFT — on commit save in DRAFT (debounced 1s after text+SO present) | Haiku | ~0.05¢ | `{ issues: [{ kind: 'vague'\|'unmeasurable'\|'estimate_mismatch', message }], severity: 'low'\|'medium'\|'high', reasoning, model }` |

**T7 detail.** Catches commits that are technically valid (5–280 chars, has SO link) but low-quality: vague verbs ("work on", "look at"), unmeasurable outcomes, scope-vs-priority mismatch (Could-priority commit phrased like a multi-week project). Renders as a subtle hint on the commit row — non-blocking, dismissible. Same `AnthropicClient` plumbing, same cost guards, same fallback discipline (silent degrade on API failure). Adds zero new infra; one prompt template, one schema, one Vitest, one Gherkin scenario in `draft-week/ai-quality-lint.feature`.

### 6.2 Cost projection (175 employees, 4 weeks/month)

~$46/mo at full scale. Per-employee monthly: ~$0.26. Soft cap $250/mo, hard cap $500/mo.

### 6.3 Cost guards (enforced server-side)

**Enforcement layer (P12).** All caps are enforced inside `AnthropicClient.preflight(kind, userId, orgId)` *before* any HTTP call. Frontend never sees budget data; it only handles 429 responses by degrading silently. This means a frontend bug cannot bypass the guard.

- **System prompt + RCDO subtree cached** at 1hr TTL → 90% cost saving on cached tokens. On `inputHash` cache hit (P13), persist a new `AIInsight` with `tokens_input=0, tokens_output=0, cost_cents=0, model='cache:<original_model>'`. `AIBudget` increments only on real Anthropic calls.
- **Per-user-per-hour caps (P23 — runaway guard):** T1 ≤ 30/hr, T2 ≤ 15/hr, T3/T4 ≤ 2/hr. Backed by Caffeine in-memory bucket keyed by `(userId, kind, hourStart)`; persisted snapshot in `ai_user_hour_counter` for audit. UPDATE…RETURNING-then-check pattern: increment first, refuse if returning row exceeds cap.
- **Per-user daily caps:** T1 ≤ 100/day, T2 ≤ 50/day, T3/T4 ≤ 5/day. Same Caffeine pattern, hour roll-up.
- **Org-level monthly cap:** read `AIBudget` row with `PESSIMISTIC_READ`; soft cap (`soft_cap_cents`, default $250) triggers async Slack alert to platform owner; hard cap (`hard_cap_cents`, default $500) returns 429 `BUDGET_EXHAUSTED` for `kind ∈ {T1, T2}`.
- **Token-bucket rate-limit:** 50 RPS sustained, 150 RPS burst per org. Excess queues 5s timeout.
- **Logging:** every Anthropic POST emits a structured log line `{userId, kind, model, tokensIn, tokensOut, cacheReadTokens, costCents, latencyMs}` so spikes are observable in production.

### 6.3a Drill-down affordance — `<InsightDrillDown>`

Every AI insight returns `affectedEntityIds` (commit IDs, supporting outcome IDs, user IDs, team IDs). The frontend wires this into a single shared component, `<InsightDrillDown>` (in `packages/shared-ui/src/components/InsightDrillDown/`), that renders each entity ID as a click-target opening a side panel with the underlying data (the commit text, the outcome's full RCDO breadcrumb, the user's recent weeks, etc.).

This is the property that separates an *interrogable* copilot from a decorative one: every AI claim is one click away from its evidence. Wired into `AIInsightPanel` for T3 (portfolio review), T4 (alignment delta), T5 (manager digest), and T6 (alignment-risk alert). T1, T2, T7 are inline single-target surfaces and don't need it.

**Component contract:**
```ts
interface InsightDrillDownProps {
  entities: Array<{ entityType: 'commit' | 'supporting_outcome' | 'user' | 'team'; entityId: string }>;
  renderTrigger?: (entity, label) => ReactNode; // default: subtle inline link
}
```

Resolves entity titles via existing RTK Query endpoints (`/commits/{id}`, `/rcdo/tree`, `/users/{id}`, etc.), opens a Flowbite `Drawer` from the right with the entity's detail card. Keyboard: `Esc` closes. ARIA: `role="dialog"` with focus trap.

### 6.4 Fallback discipline

Every AI surface has a "service unavailable" path that does not block user workflow:
- T1/T2: silent degrade — no suggestion / no warning shown. Logged.
- T3: lock proceeds; review panel shows "Portfolio review unavailable; manual retry button." Background job retries every 10min for 1hr.
- T4: reconcile proceeds; deterministic minimal delta (counts only) computed server-side as fallback. Marked `model: "deterministic"`.
- T5: deterministic templated digest if AI fails after 5 retries.
- T6: deterministic templated alert from rule + thresholds.

The user is *never* blocked by an AI failure. The manager dashboard *always* renders.

### 6.5 Eval harness

Six scenarios run on every PR labeled `prompts` and nightly on main. Cost ~$0.45/run.

- **E1:** T1 lexical-decoy correctness.
- **E2:** T2 false-positive rate ≤10% on aligned commits (20-pair fixture).
- **E3:** T3 concentration detection at 70% threshold.
- **E4:** T4 carry-forward heuristic respects `priorCarryForwardWeeks ≥ 2`.
- **E5:** T5 Slack message format (≤900 chars, mrkdwn, `<DASHBOARD_URL>` placeholder, headline-first).
- **E7:** T7 Commit Quality Lint identifies vague + unmeasurable + estimate-mismatch issues across a 12-commit fixture.

**Runner: `@wkhori/evalkit`** (the published deterministic eval framework). Fixtures in `evals/fixtures/{t1..t7}/`. `evalkit.config.ts` declares per-scenario assertion DSL (exact, contains, range, schema). Real Anthropic API at `temperature: 0`, N=3, ≥2/3 pass to absorb residual non-determinism. CI fails on regression. **LLM-as-judge layer is a v2 add** — deterministic assertions are sufficient for v1.

---

## 7. Module Federation Host/Remote Contract

Plugin: `@module-federation/vite` (verified as the maintained 2026 plugin).

### 7.1 Singletons (host + remote agree)

`react`, `react-dom`, `react-router-dom`, `@reduxjs/toolkit`, `react-redux`, `@auth0/auth0-react` (host only at runtime — remote never imports), `@throughline/shared-ui`, `@throughline/shared-types`. All marked `singleton: true` with `requiredVersion`.

### 7.2 Host shell exposes

Auth0 SPA SDK config; pushes JWT into a shared Redux slice `auth/token` from `@throughline/shared-ui`. Wraps everything in `Auth0Provider` + `Provider` + `BrowserRouter`. Routes `/weekly-commit/*` to the dynamically-imported `WeeklyCommitApp` from the remote.

### 7.3 Remote exposes

```ts
// apps/weekly-commit-remote/vite.config.ts (federation config)
exposes: {
  './WeeklyCommitApp': './src/WeeklyCommitApp.tsx',
  './WeeklyCommitRoutes': './src/WeeklyCommitRoutes.tsx',
  './api-slice': './src/api/api.ts',
},
filename: 'remoteEntry.js',
```

`WeeklyCommitApp` accepts `apiBaseUrl` prop. RTK Query base API reads JWT via `selectAuthToken` from shared store. Remote never touches Auth0 directly.

### 7.4 JWT propagation pattern

```
Auth0 SDK (host)
  → host gets token via getAccessTokenSilently
  → dispatch(authActions.setToken({ token, user }))
  → shared Redux slice (auth)
  → remote's RTK Query prepareHeaders reads selectAuthToken
  → Authorization: Bearer <jwt> on every request
```

### 7.5 CDN/CORS rules (Railway demo + AWS production)

- `remoteEntry.js`: `Access-Control-Allow-Origin: <host-origin>`, `Cache-Control: no-cache`. No long caching ever.
- Hashed `assets/*`: `Access-Control-Allow-Origin: <host-origin>`, `Cache-Control: public, max-age=31536000, immutable`.
- Backend `ALLOWED_ORIGINS` env contains the host URL and remote URL (for any direct calls).

### 7.6 Spring Security audience-validator gotcha

Spring does not validate the `aud` claim by default. We add an explicit `AudienceValidator` (`OAuth2TokenValidator<Jwt>`) into the `DelegatingOAuth2TokenValidator`. JWT `permissions` claim is mapped to authorities via custom `JwtAuthenticationConverter`. Documented and tested.

---

## 8. Notification Adapter

### 8.1 Contract

```java
public interface NotificationChannel {
  void send(NotificationEvent event);
  String name();
}
```

Selected by `@ConditionalOnProperty(prefix="app.notifications", name="channel", havingValue="<slack|outlook|log>")`. Default `slack` in prod, `log` in tests.

### 8.2 Implementations

- **`SlackChannel`** — primary, fully implemented. Posts Block Kit JSON to `app.notifications.slack.webhook-url`. Rate-limit aware (1 msg/sec/channel; backoff on 429 honoring `Retry-After`). Retry policy: 3 attempts (1s, 2s, 4s exponential).
- **`OutlookGraphChannel`** — stub. Class exists, methods compile, throws `UnsupportedOperationException`. Comments scaffold the MSAL token acquisition + `/me/sendMail` POST. Documented as the swap target.
- **`LogChannel`** — logs to SLF4J INFO. Used in tests + local dev + as a fallback when the primary fails permanently (digest job logs but does not block).

### 8.3 Trigger inventory

| Trigger | Recipient | Kind | When |
|---|---|---|---|
| Week locked | IC (self) | `LOCK_CONFIRM` | After AFTER_COMMIT phase of lock txn |
| Reconcile due | IC (self) | `RECONCILE_REMINDER` | Friday 09:00 org-tz |
| Reconcile complete | IC (self) | `RECONCILE_COMPLETE` | On RECONCILED transition |
| Manager weekly digest | Manager | `WEEKLY_DIGEST` | Monday 09:00 org-tz; idempotent per day |
| Alignment-risk alert | Manager | `ALIGNMENT_RISK` | T6 alert generation |

### 8.4 Async dispatch

Demo: Spring `ApplicationEventPublisher` + `@TransactionalEventListener(phase = AFTER_COMMIT)` + `@Async("notificationExecutor")`. AFTER_COMMIT ensures we never notify on a rolled-back transaction.

Production swap path: implement `SqsNotificationDispatcher` behind `@Profile("prod")` that publishes to SQS; an `@SqsListener` worker invokes `channel.send`. Interface and call sites unchanged.

### 8.5 Idempotency

Manager weekly digest is idempotent per `(managerId, weekStart)` — second invocation same day records `state: SKIPPED_DUPLICATE`. `dedupeKey` on `AlignmentRisk` suppresses re-firing the same alert for the same entity within 7 days unless severity escalates.

---

## 9. File-Level Architecture

Yarn Workspaces + Nx monorepo. Tree (abbreviated — every file Claude will create):

```
throughline/
├── apps/
│   ├── host/                              # MF host shell
│   │   ├── public/, src/{main.tsx,App.tsx,auth.ts,store.ts,routes.tsx,
│   │   │   components/{AppShell,ProtectedRoute,RemoteBoundary,CommandPalette,WeekSelector}.tsx,
│   │   │   remotes/weeklyCommit.ts, styles/tailwind.css, env.d.ts}
│   │   ├── index.html, nginx.conf, vite.config.ts, tsconfig.json,
│   │   │   tailwind.config.ts, postcss.config.cjs, project.json, package.json
│   └── weekly-commit-remote/              # MF remote
│       ├── src/{bootstrap.tsx,WeeklyCommitApp.tsx,WeeklyCommitRoutes.tsx,
│       │   api/{api.ts,tagTypes.ts,endpoints/{commits,weeks,rcdo,manager,ai,notifications}.ts},
│       │   features/{draft/{DraftWeek,ChessMatrix,LockReview}.tsx,
│       │   locked/LockedWeek.tsx, reconcile/Reconcile.tsx,
│       │   reconciled/ReconciledWeek.tsx, past/PastWeeks.tsx,
│       │   manager/{TeamDashboard,TeamMemberWeek,TeamInsights}.tsx,
│       │   admin/{RCDOTree,Users,Settings}.tsx},
│       │   styles/tailwind.css, env.d.ts}
│       ├── index.html, nginx.conf, vite.config.ts, tsconfig.json, project.json, package.json
├── packages/
│   ├── shared-ui/                         # singleton package shared via federation
│   │   ├── src/{index.ts,
│   │   │   store/{authSlice.ts,createBaseApi.ts,rootStoreTypes.ts},
│   │   │   tokens/{colors.css,tokens.ts},
│   │   │   components/{Button,Card,Spinner,CommitCard,RCDOPicker,AIInsightPanel,
│   │   │     InsightDrillDown,WeekPhasePill,OutcomeBreadcrumb,EmptyState,ConfirmDialog,Toast,
│   │   │     KeyboardShortcutHint,WeekSelector,CommandPalette}/{index.tsx,*.stories.tsx,*.test.tsx},
│   │   │   hooks/{useAuthToken,useApiBaseUrl,useShortcuts,useTheme}.ts}
│   │   ├── tsconfig.json, tsup.config.ts, package.json
│   └── shared-types/                      # backend DTO mirrors
│       ├── src/{index.ts,commit.ts,rcdo.ts,week.ts,user.ts,ai.ts,notification.ts}
│       ├── tsconfig.json, package.json
├── services/
│   └── api/                               # Spring Boot backend
│       ├── build.gradle.kts, settings.gradle.kts, gradle.properties, gradlew(.bat),
│       │   gradle/wrapper/, Dockerfile
│       ├── src/main/
│       │   ├── java/com/throughline/weeklycommit/
│       │   │   ├── WeeklyCommitApplication.java
│       │   │   ├── domain/{Org,Team,User,RallyCry,DefiningObjective,Outcome,
│       │   │   │   SupportingOutcome,Week,Commit,TeamPriorityWeight,
│       │   │   │   AIInsight,NotificationEvent,AlignmentRisk,AIBudget}.java
│       │   │   ├── application/{rcdo,week,commit,manager,ai,notifications}/*Service.java
│       │   │   ├── application/lifecycle/WeekStateMachine.java
│       │   │   ├── web/{AuthController,RcdoController,WeekController,CommitController,
│       │   │   │   AiCopilotController,ManagerController,CarryForwardController,
│       │   │   │   NotificationController}.java
│       │   │   ├── web/dto/*.java
│       │   │   ├── web/error/{GlobalExceptionHandler,ProblemDetailFactory}.java
│       │   │   ├── infrastructure/persistence/{AbstractAuditingEntity,AuditorAwareImpl}.java
│       │   │   ├── infrastructure/security/{SecurityConfig,AudienceValidator,JwtAuthConverter,
│       │   │   │   PermissionEvaluator}.java
│       │   │   ├── infrastructure/ai/{AnthropicClient,AnthropicClientImpl,
│       │   │   │   prompts/{T1,T2,T3,T4,T5,T6}PromptTemplate.java,
│       │   │   │   InsightCache,DeterministicFallback}.java
│       │   │   ├── infrastructure/notifications/{NotificationChannel,SlackChannel,
│       │   │   │   OutlookGraphChannel,LogChannel,NotificationDispatcher,DigestScheduler}.java
│       │   │   └── infrastructure/messaging/{TransactionalEventBroker}.java
│       │   └── resources/{application.yml,application-dev.yml,application-prod.yml,
│       │       logback-spring.xml,db/migration/V1..V4__*.sql,R__seed_demo.sql}
│       └── src/test/{java/com/throughline/weeklycommit/{web,application,infrastructure}/*Test.java,
│           resources/{application-test.yml,features/*.feature,fixtures/*.json}}
├── cypress/
│   ├── e2e/{auth/{login,role-access},admin-rcdo/{rallycry-crud,rcdo-validation},
│   │   week-management/current-week, draft-week/{commit-crud,ai-outcome-suggestion,ai-drift-warning},
│   │   lifecycle/{lock-week,reconcile-week,carry-forward,state-machine-guards},
│   │   manager/{dashboard,alignment-risk-alerts}, notifications/slack-digest,
│   │   performance/dashboard-pagination}/{*.feature,steps.ts}
│   ├── fixtures/, support/{e2e.ts,commands.ts,auth0.ts}, tsconfig.json
├── evals/
│   ├── fixtures/{t1..t6}/, runner.ts, package.json
├── infra/
│   ├── README.md
│   ├── terraform/{main,variables,outputs,providers,versions}.tf
│   │   ├── modules/{network,eks,rds,static-bundle,messaging,iam}/{main,variables,outputs}.tf
│   │   └── environments/{dev,prod}/{main.tf,terraform.tfvars,backend.tf}
│   └── helm/weekly-commit-api/{Chart.yaml,values.yaml,templates/{_helpers.tpl,deployment,service,ingress,hpa,configmap}.yaml}
├── .github/workflows/{ci,deploy,aws-deploy}.yml
├── .editorconfig, .gitignore, .nvmrc, .cursorrules, .env.example
├── eslint.config.js, prettier.config.js, nx.json, tsconfig.base.json,
├── package.json (yarn workspaces), cypress.config.ts, .cypress-cucumber-preprocessorrc.json
├── docker-compose.yml (local Postgres 16.4 for dev), docker-compose.observability.yml (Phase 7 opportunistic)
├── README.md, CLAUDE.md, ARCHITECTURE.md, PRD.md
└── docs/{architecture-decisions.md, ai-copilot-spec.md, AWS-MIGRATION.md, prd-patches.md}
```

> Authoritative file-by-file content (vite configs, security config, package layout, build.gradle.kts, all canonical) lives in the MF/Infra spec section the implementing agent will follow. The companion `ARCHITECTURE.md` will be generated during build with the diagrams.

---

## 10. Test Plan (Test-First, SDD + TDD)

Test artifacts are written **before** implementation in every phase. Three layers, all required:

### 10.1 Cypress + Cucumber/Gherkin (acceptance)

`@badeball/cypress-cucumber-preprocessor` v22, the maintained fork. Folder: `cypress/e2e/<area>/<feature>.{feature,steps.ts}`.

**Feature file inventory** (each one's full Gherkin text is the deliverable for its phase):

1. `auth/login.feature` — Phase 1
2. `auth/role-access.feature` — Phase 1
3. `admin-rcdo/rallycry-crud.feature` — Phase 1
4. `admin-rcdo/rcdo-validation.feature` — Phase 1
5. `week-management/current-week.feature` — Phase 2
6. `draft-week/commit-crud.feature` — Phase 2
7. `lifecycle/state-machine-guards.feature` — Phase 2
8. `lifecycle/lock-week.feature` — Phase 2 (test stubs) → Phase 5 (AI assertions enabled)
9. `lifecycle/reconcile-week.feature` — Phase 3 (stubs) → Phase 5 (AI assertions)
10. `lifecycle/carry-forward.feature` — Phase 3
11. `manager/dashboard.feature` — Phase 4 (stubs) → Phase 5 (AI assertions)
12. `manager/alignment-risk-alerts.feature` — Phase 5
13. `draft-week/ai-outcome-suggestion.feature` — Phase 5
14. `draft-week/ai-drift-warning.feature` — Phase 5
15. `notifications/slack-digest.feature` — Phase 6
16. `performance/dashboard-pagination.feature` — Phase 4 (perf gate)

Tags: `@auth`, `@ai`, `@happy-path`, `@edge`, `@regression`, `@ai-fallback`, `@perf`, plus phase tags `@phase-1` … `@phase-6`. Use `Scenario Outline + Examples` for role-based access matrices. Every AI surface has an `@ai-fallback` scenario verifying graceful degradation.

The full Gherkin text for every scenario is appended to the implementing agent's task on a per-phase basis (see Phase plan).

### 10.2 Backend contract tests (Spring `@WebMvcTest`)

For every endpoint, methods covering: happy path 2xx, validation 400, auth 401, forbidden 403, not-found 404, illegal-state 409, server error 500. Naming: `ControllerName.endpoint_action_condition_expected()`.

Coverage includes `AuthController`, `RcdoController`, `WeekController`, `CommitController`, `AiCopilotController`, `ManagerController`, `CarryForwardController`, `NotificationController`. Total ~120 contract tests across the surface.

JaCoCo line coverage gate **≥80%** enforced via `jacocoTestCoverageVerification` bound to `verify`. CI fails on regression.

### 10.3 Vitest component tests

Per-component test list covers: render, props variants, user interactions, RTK Query loading state, RTK Query error state, AI fallback state. Inventoried for: `RcdoTreeEditor`, `RcdoNodeForm`, `WeekShell`, `ChessMatrix`, `CommitCard`, `CommitForm`, `AiSuggestionPanel`, `DriftWarningBanner`, `LockWeekDialog`, `PortfolioReviewPanel`, `ReconcileForm`, `AlignmentDeltaPanel`, `ManagerDashboard`, `TeamMemberTable`, `ExceptionRibbon`, `CarryForwardCheckbox`, `RoleGuardedRoute`, `NotificationStatusBadge`. Total ~150 tests.

Vitest coverage gate **≥80%** lines/branches/functions/statements. CI fails on regression.

### 10.4 Eval scenarios (AI)

5 scenarios in `evals/fixtures/{t1..t6}/`. Run on PRs labeled `prompts` and nightly on `main`. See §6.5.

### 10.5 Metrics & Instrumentation (P1)

The brief lists four impact metrics. Each is captured and exposed via `GET /api/v1/metrics/org` (ADMIN scope), plus surfaced read-only on the admin Settings screen.

| Metric | Definition | Source |
|---|---|---|
| `planningCompletionRate` | (count of weeks locked by Friday EOD) / (count of active ICs) for current week | `Week.lockedAt` vs. cutoff |
| `reconciliationStrictPct` | (DONE commits) / (reconciled commits) over last 4 weeks | `Commit.reconciliationOutcome` |
| `reconciliationWeightedPct` | (DONE × 1.0 + PARTIAL × 0.5) / (reconciled commits) over last 4 weeks | `Commit.reconciliationOutcome` |
| `avgManagerDigestViewMinutesAfterDeliver` | Avg minutes between digest `sentAt` and the manager's first viewing of `/manager/digest/current` | `NotificationEvent.sentAt`, `digestViewedAt` (new field) |
| `planningSessionMinutesP50` | P50 minutes between `Week.createdAt` and `Week.lockedAt` for ICs | `Week` timestamps |

Instrumentation:
- New column `notification_event.viewed_at timestamptz` (V6 migration).
- `MetricsService` aggregates on read (no precompute needed for demo scale).
- `metrics.feature` Gherkin in Phase 7 verifies seeded values produce expected metric ranges.

---

## 11. Seed Data Spec

Generator: `services/api/src/test/java/.../SeedData.java` (Spring Boot CommandLineRunner active under `dev` profile and `R__seed_demo.sql`).

**Volume.** 1 org, 175 users (150 ICs, 20 managers, 5 admins), 12 teams of ~14 reports, 4 weeks of history.

**RCDO tree.** 4 Rally Cries, 12 DOs (3 per RC), 36 Outcomes (3 per DO), 144 Supporting Outcomes (4 per Outcome). Realistic SaaS/B2B language (e.g., "Win the SMB segment", "Reduce 30-day churn by 15%", "Self-serve onboarding NPS > 50").

**Manager hierarchy.** Each IC has `managerId` set; managers have a manager (director-level); admins have no manager. Realistic team structure mirrored on `Team`.

**Commit history (4 weeks).** Each IC has 4 weeks of LOCKED+RECONCILED activity. Distribution rules:
- Average 5 commits per IC per week (range 3–7).
- Reconciliation outcomes: ~55% DONE, ~25% PARTIAL, ~20% NOT_DONE.
- Carry-forward rate: ~15% of NOT_DONE commits flagged carry-forward.

**Deliberate dysfunction (the demo set-piece).** The seed deliberately injects four pre-set issues so the AI dashboards immediately show signal:

1. **Starved Outcome** — Outcome "Expand enterprise pipeline Q2" (one of the 36) has zero commits org-wide for 2 consecutive weeks (current and previous). Triggers T6 starved-outcome alert.
2. **4-week carry-forward** — A commit on team "Growth Eng", IC "Sarah Mendez", with text "Refactor billing service test suite" has been carry-forwarded 4 weeks running, original lineage chain length 5. Triggers T6 long-carry-forward alert at HIGH severity.
3. **Drifting team** — Team "Platform Reliability" has its locked weeks 65% concentrated on a single Supporting Outcome ("Reduce P1 incident MTTR < 30min") while team priority signal expects 30–50% spread across 3 outcomes. Triggers T6 over-concentration alert.
4. **Over-indexed manager** — Manager "Jordan Kim" has 8 reports; 6 of them are concentrated on the same Outcome. Manager digest highlights this.

Demo accounts (Auth0 dev tenant): `ic@demo.throughline.app`, `manager@demo.throughline.app`, `admin@demo.throughline.app` — each impersonates a seeded user with rich data.

**Generator location:** `services/api/src/main/java/com/throughline/weeklycommit/infrastructure/seed/DemoSeeder.java`. Idempotent (skip if `Org` count > 0). Activates only on `dev` Spring profile. Documented in `README.md`.

---

## 12. Phased Build Plan (Test-First Ordering)

Each phase begins with **writing the test layer** (Gherkin `.feature` files + backend contract test stubs + Vitest test names), then implementation, then verification (CI green at coverage gates). Phases are ordered so each is shippable and testable in isolation.

### Phase 0 — Repo bootstrap

**Tests first:** none (infra phase).
**Implementation:** Nx + Yarn Workspaces; root configs (`package.json`, `nx.json`, `tsconfig.base.json`, `eslint.config.js`, `prettier.config.js`, `.editorconfig`, `.nvmrc`, `.cursorrules`, `.env.example`); `apps/host/`, `apps/weekly-commit-remote/`, `packages/shared-ui/`, `packages/shared-types/`, `services/api/` skeletons; baseline CI workflow (`.github/workflows/ci.yml`) — lint + type-check + build only.

**Local dev environment:**
- `docker-compose.yml` at root spinning up Postgres 16.4 with `throughline` database, user `throughline`, password `throughline`, port 5432. Ready via `docker compose up -d`.
- `.env.example` at root listing every env var with placeholder + comment indicating where to source it. Copy to `.env.local` (gitignored) and fill before running.
- `services/api/src/main/resources/application-test.yml` uses Testcontainers Postgres (already in build.gradle.kts) for backend integration tests — no manual DB setup needed for tests.

**Required env vars (placeholders in `.env.example`):**
```
# Database (Docker provides these; matches docker-compose.yml)
DATABASE_URL=jdbc:postgresql://localhost:5432/throughline
DATABASE_USER=throughline
DATABASE_PASSWORD=throughline

# Auth0 (free dev tenant — required for Phase 1)
AUTH0_ISSUER_URI=https://YOUR_TENANT.auth0.com/
AUTH0_AUDIENCE=https://api.throughline.app
VITE_AUTH0_DOMAIN=YOUR_TENANT.auth0.com
VITE_AUTH0_CLIENT_ID=YOUR_SPA_CLIENT_ID
VITE_AUTH0_AUDIENCE=https://api.throughline.app

# Frontend → backend
VITE_API_BASE_URL=http://localhost:8080
VITE_WEEKLY_COMMIT_REMOTE_URL=http://localhost:5174/remoteEntry.js

# Anthropic (required for Phase 5a)
ANTHROPIC_API_KEY=sk-ant-...

# Slack (required for Phase 6 — private channel webhook works)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
NOTIFICATION_CHANNEL=slack

# Org config
ORG_TIMEZONE=America/New_York

# Optional dev flags
VITE_DEV_PERSONAS=false
SPRING_PROFILES_ACTIVE=dev
```

**Exit:** `yarn install`, `yarn nx run-many -t lint type-check build` all green; `./gradlew :services:api:build` green; `docker compose up -d` brings Postgres up; `psql $DATABASE_URL -c '\\l'` lists the throughline database; CI passes on a no-op PR.

### Phase 1 — Foundation: Auth, Schema, RCDO, Seed (P7)

**Tests first:**
- Cypress: `auth/login.feature`, `auth/role-access.feature` (includes manager-locks-own-week scenario per P6), `admin-rcdo/rallycry-crud.feature`, `admin-rcdo/rcdo-validation.feature`.
- Spring: contract tests for `AuthController`, `RcdoController` (all happy/auth/validation/conflict cases). Tests for `ManagerScope.canSee()` covering: self, direct report, transitive report, unrelated user, ADMIN bypass.
- Vitest: `RcdoTreeEditor`, `RcdoNodeForm`, `RoleGuardedRoute`.

**Implementation:**
- Flyway migrations `V1__init.sql`, `V2__rcdo_tree.sql`.
- `AbstractAuditingEntity`, `AuditorAware`.
- `SecurityConfig` with audience validator and `permissions`-claim mapper.
- `RoleHierarchy` bean (`ADMIN > MANAGER > IC`) per P6.
- `ManagerScope` service + `@managerScope` SpEL bean for `@PreAuthorize` per P9.
- Auth0 dev tenant created; seeded users for IC/Manager/Admin.
- RCDO domain entities + JPA repos + admin CRUD service + REST controllers.
- Host shell wires Auth0 SPA SDK + token push to shared `auth` slice.
- RCDO admin authoring UI (Linear-style outline tree with delete-guards).
- **`DemoSeeder` Phase 1 stage (P7):** Spring `CommandLineRunner` under `dev` profile seeding 1 org, 175 users with manager hierarchy, 12 teams, full RCDO tree (4 RC × 3 DO × 3 Outcome × 4 SO = 144 SOs), team priority weights at RC granularity per P4 (weights sum to 1.0 with realistic skew). Idempotent.
- **Federation singleton smoke test (P22):** `packages/shared-deps-versions.json` consumed by both vite configs; Cypress test that loads host, navigates to remote, asserts `localStorage.auth.token` and a successful `/me` 200.

**Exit:** All Phase 1 Gherkin scenarios pass; backend coverage ≥80% on touched packages; Vitest ≥80% on touched components; CI green; manual smoke: log in as admin, create a full RCDO tree; federation smoke test green.

### Phase 2 — Lifecycle Core: Weeks, Commits, Lock

**Tests first:**
- Cypress: `week-management/current-week.feature`, `draft-week/commit-crud.feature`, `lifecycle/state-machine-guards.feature`, `lifecycle/lock-week.feature` (AI-gated steps tagged `@ai` skipped until Phase 5).
- Spring: `WeekController`, `CommitController` contract tests.
- Vitest: `WeekShell`, `ChessMatrix`, `CommitCard`, `CommitForm`, `LockWeekDialog`.

**Implementation:**
- Flyway `V3__commits.sql`.
- `WeekStateMachine` Spring service with guarded transitions.
- Week domain + commit CRUD + chess-layer fields.
- Lock endpoint with validations (≥1 commit, every commit has SO).
- DRAFT and LOCKED screens (`DraftWeek`, `ChessMatrix`, `LockReview`, `LockedWeek`) with keyboard nav.
- Week boundary logic in org timezone (DST-safe).

**Exit:** Phase 2 Gherkin pass; perf check: `GET /weeks/current` <200ms; CI green.

### Phase 3 — Reconciliation & Carry-Forward

**Tests first:**
- Cypress: `lifecycle/reconcile-week.feature` (AI-gated steps skipped), `lifecycle/carry-forward.feature`.
- Spring: `WeekController.reconcile*`, `CarryForwardController` contract tests.
- Vitest: `ReconcileForm`, `CarryForwardCheckbox`.

**Implementation:**
- RECONCILING/RECONCILED transitions in state machine.
- Reconciliation submission with three-state outcomes + notes (≤1000) + carry-forward flags.
- Carry-forward spawns: original → CARRIED_FORWARD; new DRAFT in week N+1 with `parentCommitId`; counter increment.
- Reconcile UI (`Reconcile.tsx`), ReconciledWeek view with lineage timeline.

**Exit:** Phase 3 Gherkin pass; carry-forward chains queryable via recursive CTE; CI green.

### Phase 4 — Manager Dashboard (with materialized rollup per P10/P25)

**Tests first:**
- Cypress: `manager/dashboard.feature` (AI digest steps gated), `performance/dashboard-pagination.feature` (perf gate hard-set).
- Spring: `ManagerController` contract tests including the 2000-record perf assertion. Scope-check tests per P9 (manager A cannot see manager B's reports).
- New: `services/api/src/test/java/.../perf/EndpointPerformanceTest.java` per P2 — Gradle `perfTest` task asserting p95 <200ms on `/weeks/current` and `/manager/team-rollup?page=0&size=50` against a 2000-row seed.
- Vitest: `ManagerDashboard`, `TeamMemberTable`, `ExceptionRibbon`.

**Implementation:**
- V5 migration adds `team_rollup_cache` table (per P10).
- `MaterializedRollupJob` Spring `@Scheduled` running 30 min before Monday digest cron + on every `WeekReconciledEvent`. Recomputes per-team rollup payload and stores in cache.
- `/manager/team-rollup` paginated endpoint (Spring `Pageable`) reads from cache; falls back to live compute with a 503 "computing" if cache is older than one week.
- Team member week drill-down (`/manager/team/{userId}/week/current`) with `@managerScope.canSee` per P9.
- Manager dashboard UI (full-bleed) with skeleton AI digest hero (placeholder until Phase 5c), starved-outcomes panel (computed deterministically), drift exceptions panel, exception ribbon, dense roster table.
- Update `DemoSeeder` Phase 2 stage to include the four dysfunction scenarios so the rollup cache populates with realistic data.

**Exit:** First page returns in <200ms p95 with 2000 records under `perfTest`; CI green; manager scope test pass.

### Phase 5 — AI Strategic Alignment Copilot (split into 5a / 5b / 5c per P24)

#### Phase 5a — Anthropic infra + T1/T2 (Haiku surfaces)

**Tests first:**
- Cypress: `draft-week/ai-outcome-suggestion.feature`, `draft-week/ai-drift-warning.feature` (includes `@ai-fallback` scenarios).
- Spring: `AiCopilotController` contract tests for T1/T2 (happy + fallback + 429 budget exhausted).
- Eval harness: scenarios E1, E2 in `evals/fixtures/{t1,t2}/`.
- Vitest: `AiSuggestionPanel`, `DriftWarningBanner`.

**Implementation:**
- `AnthropicClient` (OkHttp + Jackson) with prompt-cache header, retries, timeouts.
- `AnthropicClient.preflight()` enforcing per-user-per-hour cap (P23), per-user-per-day cap, org monthly cap (P12).
- `AIInsightCache` 60s dedupe by `inputHash`; cache-hit cost accounting with `cost_cents=0` and `model='cache:<original>'` per P13.
- T1/T2/T7 prompt templates (full text from `docs/ai-copilot-spec.md`).
- Cost-guard structured logging on every Anthropic POST.
- Frontend: `AIInsightPanel` (panel + mini variants), `CommitQualityHint` inline on commit rows, wired into DraftWeek.

**Exit:** T1/T2/T7 Gherkin pass; E1/E2/E7 evals pass; budget-exhaustion contract test passes (429 → silent UI degrade); CI green.

#### Phase 5b — T3/T4 (Sonnet sync paths) + websocket fallback

**Tests first:**
- Cypress: enable AI-gated scenarios in `lifecycle/lock-week.feature` and `lifecycle/reconcile-week.feature`.
- Spring: contract tests for `/ai/portfolio-review/{weekId}`, `/ai/alignment-delta/{weekId}` including scope-check (P15) and async-fallback (timeout >8s/10s).
- Eval harness: scenarios E3, E4.
- Vitest: `PortfolioReviewPanel`, `AlignmentDeltaPanel`.

**Implementation:**
- T3/T4 prompt templates.
- `DeterministicFallback` for T3 (skeleton review) and T4 (counts-only delta marked `model: "deterministic"`).
- WebSocket auth + scoping per P16: STOMP over SockJS; `ChannelInterceptor` validates JWT in CONNECT; `WeekSecurityFilter` on `/topic/insights.{weekId}`.
- Sync timeout → async via WS pattern.
- `priorCarryForwardWeeks` semantic for T4 input per P11 (current commit's `carry_forward_weeks` BEFORE mutation).
- Frontend: `AIInsightPanel` hero + inline variants on LockReview/LockedWeek/Reconcile/ReconciledWeek.
- **`<InsightDrillDown>` component (per §6.3a)** in `packages/shared-ui/src/components/InsightDrillDown/`. Wired into `AIInsightPanel` to make every `affectedEntityIds` click-through to underlying entity detail in a Flowbite Drawer. Vitest tests: render, entity types (commit/SO/user/team), keyboard close, ARIA focus trap.

**Exit:** AI-gated lifecycle Gherkin pass; E3/E4 evals pass; deterministic fallback scenarios pass; websocket security tested; CI green.

#### Phase 5c — T5/T6 (manager surfaces) + cron + dedupe

**Tests first:**
- Cypress: `manager/alignment-risk-alerts.feature`; manager-dashboard `@ai`-tagged steps re-enabled.
- Spring: contract tests for T5 generation, T6 background scan, `AlignmentRisk.acknowledge` endpoint per P14.
- Eval harness: scenario E5.

**Implementation:**
- T5/T6 prompt templates.
- `AlignmentRiskScanJob` `@Scheduled` hourly; rule-fired triggers; `dedupeKey = sha1(rule + ':' + entityType + ':' + entityId + ':' + severity + ':' + ISO_WEEK(weekStart))` per P5; 7-day suppression unless severity escalates.
- `POST /api/v1/manager/alignment-risks/{id}/ack` endpoint + `AlignmentRiskService.acknowledge(id, userId)` per P14.
- `/manager/digest/current` endpoint feeding the dashboard hero card per P17.
- Deterministic fallback for T5 (skeleton digest from counts) and T6 (template library keyed by `rule`).

**Exit:** Manager Gherkin pass; E5 eval passes; ack endpoint round-trips; CI green.

### Phase 6 — Notifications

**Tests first:**
- Cypress: `notifications/slack-digest.feature`.
- Spring: `NotificationController` contract tests including idempotency, retry, and channel-failure-fallback.
- Vitest: `NotificationStatusBadge`.

**Implementation:**
- `NotificationChannel` interface + `SlackChannel` (Block Kit, rate-limit-aware) + `OutlookGraphChannel` stub + `LogChannel`.
- `NotificationDispatcher` with `@TransactionalEventListener(AFTER_COMMIT)` + `@Async`.
- Cron jobs: Friday 09:00 reconcile reminder; Monday 09:00 manager digest (idempotent per `(managerId, weekStart)`).
- T6 alerts emit `ALIGNMENT_RISK` events to Slack.

**Exit:** Phase 6 Gherkin pass; manual smoke: a real Slack workspace receives a real digest.

### Phase 7 — Polish + Metrics

**Tests first:**
- Golden-data assertion that the seeded org (which now exists from Phase 1+) produces all four dysfunction triggers (starved Outcome detected, 4-week carry-forward visible, drifting team flagged, over-indexed manager surfaced).
- `metrics.feature` Gherkin asserting `/metrics/org` returns expected ranges from seed.

**Implementation:**
- `MetricsService` + `/metrics/org` endpoint per P1.
- V6 migration adds `notification_event.viewed_at` and digest-view tracking endpoint.
- Linear-grade UI polish pass: design tokens (`@theme`), keyboard navigation (`tinykeys` + scope router), command palette (`cmdk`), motion guidelines, accessibility (focus rings, drag-drop keyboard equivalents, ARIA on chess matrix).
- Performance pass: lazy routes, code splitting, Lighthouse first-contentful-paint <1s on the IC DraftWeek route.
- **Opportunistic — only if Phase 6 is green with headroom:** wire `micrometer-registry-prometheus` + `/actuator/prometheus`; add `docker-compose.observability.yml` overlay with Prometheus + a single Grafana dashboard showing `http_server_requests`, `ai_anthropic_calls_total`, `ai_anthropic_cost_cents_total`, `digest_send_total`. No alerts wired. **Skip if at risk.**

**Exit:** Manual demo run with seeded data showcases all seven AI surfaces with substantive insights; CI green; all tests green; metrics endpoint returns realistic values.

### Phase 8 — Deploy

**Tests first:** Slack webhook health check per P26.

**Implementation:**
- Railway services provisioned: `host-shell`, `weekly-commit-remote`, `weekly-commit-api`, `postgres`.
- Env vars per service from §13.2.
- Auth0 production callback URLs and CORS origins updated.
- `.github/workflows/deploy.yml` — Railway CLI deploy on `main` merge.
- Terraform skeleton in `infra/terraform/` (modules + dev env stub) committed; runnable `terraform plan` in dev.
- Helm chart for `weekly-commit-api` with deployment/service/ingress/hpa/configmap templates.
- `.github/workflows/aws-deploy.yml` workflow_dispatch placeholder targeting ECR + EKS + S3 + CloudFront.
- `infra/README.md` documents the swap path.
- **Slack health indicator (P26):** `SlackHealthIndicator` `HealthIndicator` posts a heartbeat on every app boot (or hourly cached); `/actuator/health/readiness` reports DOWN if Slack unreachable AND `NOTIFICATION_CHANNEL=slack`. Phase 8 smoke step posts manual `/notifications/digest/run` and observes Slack message in `#weekly-digests`.

**Exit:** Hosted URL live and demonstrable; **`terraform init && terraform validate && terraform plan` runs clean** for `infra/terraform/environments/dev` against a real AWS provider (output committed under `infra/terraform/environments/dev/plan-output.txt` so reviewers can see the swap path is real, not pseudocode); Helm chart `helm lint` clean; Slack heartbeat green; manual digest smoke posts to Slack successfully.

---

## 13. Deployment Plan

### 13.1 Demo (Railway)

| Service | Type | Notes |
|---|---|---|
| `host-shell` | Static (Nginx) | Serves `apps/host/dist`. CORS open. SPA fallback. |
| `weekly-commit-remote` | Static (Nginx) | Serves remote bundle. `Access-Control-Allow-Origin: <host-origin>`, `Cache-Control: no-cache` on `remoteEntry.js`, `immutable` on hashed assets. |
| `weekly-commit-api` | Docker (Spring Boot) | Health probes wired to `/actuator/health/{readiness,liveness}`. |
| `postgres` | Railway managed Postgres 16.4 | `DATABASE_URL` injected. |

### 13.2 Env vars (canonical)

`host-shell`: `VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`, `VITE_AUTH0_AUDIENCE`, `VITE_API_BASE_URL`, `VITE_WEEKLY_COMMIT_REMOTE_URL`, `PORT` (Railway).

`weekly-commit-api`: `DATABASE_URL`, `DATABASE_USER`, `DATABASE_PASSWORD`, `AUTH0_ISSUER_URI`, `AUTH0_AUDIENCE`, `ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY`, `SLACK_WEBHOOK_URL`, `NOTIFICATION_CHANNEL=slack`, `ORG_TIMEZONE=America/New_York`, `PORT` (Railway), `SPRING_PROFILES_ACTIVE=dev`.

### 13.3 Auth0 dev tenant

Application type: SPA (host) + API (audience `https://api.throughline.app`). Allowed callbacks: `https://<host>.up.railway.app, http://localhost:5173`. Allowed Web Origins / CORS: same. Seeded users with role custom claim `permissions: [IC|MANAGER|ADMIN]`.

### 13.4 Slack

Free workspace `throughline-demo`. Incoming webhook posts to `#weekly-digests`. Block Kit conventions per Slack docs (header → sections → divider → context → actions). Rate-limit aware; retries on 429 honoring `Retry-After`.

### 13.5 Anthropic

API key from console. Models pinned: `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`. Prompt-cache headers enabled.

### 13.6 Production target (AWS, via Terraform skeleton)

Topology, module list, and swap-path in `docs/architecture-decisions.md` §3 and `infra/README.md`. Runnable `terraform plan` for dev; production runtime not stood up for the demo.

---

## 14. Definition of Done

The project is complete when **every** item below holds:

1. **Hosted demo URL live** on Railway, demonstrable end-to-end (admin authors RCDO → IC drafts week → AI suggests outcomes → IC locks → AI portfolio review → Friday reconciles → AI alignment delta → Monday manager digest in Slack).
2. **Repo public** on GitHub with clean history.
3. **`CLAUDE.md`** present at root and matches the methodology in this conversation.
4. **`docs/architecture-decisions.md`** present with the 33-row table.
5. **`README.md`** present with: project description, demo URL, repo structure, how-to-run-locally, env-var checklist, demo accounts.
6. **`ARCHITECTURE.md`** present with: domain model diagram, lifecycle state machine, MF host/remote contract, AI copilot data flow, notification adapter design.
7. **`PRD.md`** (this document) present.
8. **`docs/ai-copilot-spec.md`** present with full prompt text + JSON schemas + eval scenarios.
9. **CI green on `main`** with coverage gates: JaCoCo ≥80%, Vitest ≥80%, all Cypress scenarios pass, all eval scenarios pass.
10. **All Phase 1–8 Gherkin scenarios pass** in CI.
11. **AI fallback verified end-to-end:** with `ANTHROPIC_API_KEY` invalidated locally, the demo flow still completes — manager dashboard renders, locks succeed, reconciliations submit.
12. **Seed data dysfunctions visible** on the manager dashboard immediately after demo login.
13. **Performance gates met:** `GET /weeks/current` <200ms; manager team-rollup first page <200ms with 2000 records; FCP <1s on Draft route.
14. **Submission artifacts:** hosted URL, repo URL, copy of `CLAUDE.md`.

---

## 15. Deferred / Out of Scope

Explicitly **not** in this PRD body. Recorded so that scope creep is visible.

- **Real EKS/CloudFront/SQS/SNS deploy.** Substituted with Railway + Terraform skeleton + Helm chart + AWS-deploy workflow. Swap path in `docs/architecture-decisions.md`.
- **Outlook Graph integration runtime.** Stubbed at the channel-adapter layer; Slack runs in production.
- **Playwright.** Removed in favor of Cypress + Cucumber/Gherkin alone.
- **Mobile app / responsive sub-tablet layouts.** Tablet+ supported; phone is not a target for this work sample.
- **Multi-tenant onboarding wizard.** Single seeded org for demo.
- **Real-time collaboration** (multiple ICs editing same week). Not a real use case; weeks are per-user.
- **Audit log UI.** Audit data is captured (`AbstractAuditingEntity`); a viewer UI is not in scope.
- **Drag-reparent on the RCDO tree.** Reorder within siblings is in scope; cross-parent move is not.
- **AI streaming responses** to UI. Synchronous up to budget, async (websocket) on overflow. SSE/streaming UX not in scope.
- **Org admin UI for AI budget config.** Budgets editable via DB / config only.
- **Outlook Graph stub becoming functional.** Stub remains a stub; the swap path is documented.
- **Customer-facing analytics export (CSV/PDF).** Manager dashboards on-screen only.

---

## 16. Assumptions Locked (Defaults Annotated)

- **Org timezone default:** `America/New_York`. Configurable via `Org.timezone`.
- **Week start day:** `MONDAY`. Configurable via `Org.weekStartDay`.
- **Max commits per IC per week:** **7**. Not specified by brief; chosen as a soft cap balancing weekly throughput against decision fatigue. Configurable later.
- **Commit text length:** 5–280 chars. Tweet-length forces specificity.
- **Reconciliation note length:** 1000 chars. Long enough for a paragraph; short enough that AI reads it cheaply.
- **Reconciliation accuracy reporting:** strict % (DONE only) and weighted % (DONE=1.0, PARTIAL=0.5, NOT_DONE=0).
- **Manager hierarchy:** `User.managerId` self-FK (not Auth0 metadata).
- **AI provider:** Anthropic. Haiku 4.5 for high-volume; Sonnet 4.6 for analytical.
- **AI cost soft cap:** $250/mo/org. Hard cap: $500/mo/org. Both editable via DB.
- **Notification channel:** Slack in demo. Outlook Graph stubbed.
- **Permissions claim format:** Auth0 `permissions: [IC|MANAGER|ADMIN]`.
- **JWT `aud`:** validated explicitly via `AudienceValidator`.
- **Sizing for phases:** S/M/L/XL bands implied by the test-and-implementation surface; no time estimates.

---

*End of PRD.*
