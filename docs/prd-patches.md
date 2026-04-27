# PRD Patches Applied (Loop 5 Gap Check)

The Challenger pass surfaced 26 specific patches against `PRD.md`. This document is the canonical record of every patch, its severity, where it applies, and its status. Critical patches (10) are applied inline in `PRD.md` and reflected in this document. Important patches (12) are scoped for application during their relevant phase. Minor patches (4) are queued.

The implementing agent must consult this document when starting any phase. If a patch is listed and not yet applied, apply it before writing the phase's first line of code.

---

## Critical (applied inline in PRD.md)

| ID | Issue | Resolution | Where applied |
|---|---|---|---|
| P1 | Brief impact metrics (planning completion rate, reconciliation accuracy, manager turnaround, time-to-plan) not instrumented | Add `MetricsService` + `/api/v1/metrics/org` + `digest_viewed_at` capture + `metrics.feature` Phase 7 | New §10.5 |
| P3 | `AIBudget` lacks audit columns despite global rule | Add audit columns to `ai_budget` migration; entity extends `AbstractAuditingEntity` | §3.3 V4, §3.1 |
| P6 | Role hierarchy ambiguous — does MANAGER imply IC? | Add `RoleHierarchy` bean: `ADMIN > MANAGER > IC`; managers can lock their own week | §3.1, §13.3, Phase 1 |
| P7 | `DemoSeeder` in Phase 7 but Phase 5 evals need seeded data | Move seeder to Phase 1; extend per phase (Phase 1 RCDO/users; Phase 2 locked weeks; Phase 3 reconciliations; Phase 5 alerts) | §12 Phase 1, Phase 5, Phase 7 |
| P9 | Manager endpoints not scoped to direct reports | `@PreAuthorize("@managerScope.canSee(#userId, principal)")`; walks `User.managerId` chain; ADMIN bypass | §4.1, Phase 1, Phase 4 |
| P12 | AI cost guard enforcement layer unspecified | Enforced server-side in `AnthropicClient.preflight()` with PESSIMISTIC_READ on `AIBudget`; per-user via Caffeine bucket | §6.3 |
| P15 | AI insight endpoints not scope-checked | Apply `@managerScope.canSee(week.userId, principal)` to `/ai/portfolio-review/{weekId}` and `/ai/alignment-delta/{weekId}` | §4.1 |
| P22 | MF singleton drift will surface late | `packages/shared-deps-versions.json` as single source for `requiredVersion`; Cypress federation smoke test | §7, Phase 0 |
| P23 | Single-user runaway can exhaust org budget | Hard per-user-per-hour cap (T1 ≤ 30/hr, T2 ≤ 15/hr); UPDATE…RETURNING-then-check pattern | §6.3 |
| P24 | Phase 5 bundles six AI surfaces — high slip risk | Split into 5a (Anthropic client + cost guard + T1/T2), 5b (T3/T4 + websocket + deterministic fallback), 5c (T5/T6 + cron + dedupe) | §12 |

---

## Important (apply when entering the relevant phase)

| ID | Issue | Resolution | Phase |
|---|---|---|---|
| P2 | Perf gate has no harness | `services/api/src/test/.../perf/EndpointPerformanceTest.java` + Gradle `perfTest` task; assert p95 <200ms on 2000-row seed | Phase 2 + Phase 4 |
| P4 | Team priority weight seed missing | Add team-weight seed to `R__seed_demo.sql`; RC-level granularity; weights sum to 1.0 with realistic skew | Phase 1 |
| P5 | `dedupeKey` algorithm undefined | `dedupeKey = sha1(rule + ':' + entityType + ':' + entityId + ':' + severity + ':' + ISO_WEEK(weekStart))` | Phase 5c |
| P8 | Concurrent lock race undefined | Lock idempotent on terminal LOCKED — replay returns 200 with prior `portfolioReview` snapshot; `OptimisticLockException` translated | Phase 2 |
| P10 | Manager rollup cache materialization timing missing | `MaterializedRollupJob` `@Scheduled` 30min before Monday digest cron + on every `WeekReconciledEvent`; `team_rollup_cache` table | Phase 4 |
| P11 | `priorCarryForwardWeeks` semantic for T4 ambiguous | At reconcile time = current commit's `carry_forward_weeks` BEFORE mutation | Phase 5b |
| P13 | Cache-hit cost-accounting | On `inputHash` cache hit persist `AIInsight` with `cost_cents=0, model='cache:<original>'`; `AIBudget` increments only on real calls | Phase 5a |
| P14 | `AlignmentRisk` acknowledge endpoint missing | `POST /api/v1/manager/alignment-risks/{id}/ack` + `AlignmentRiskService.acknowledge` + Cypress | Phase 5c |
| P16 | WebSocket auth/scoping not specified | STOMP over SockJS; `ChannelInterceptor` validates Bearer JWT in CONNECT; subscription path filtered by `WeekSecurityFilter` | Phase 5b |
| P18 | Reconcile window vs Friday digest mis-aligned | Add `Org.reconcileOpensDayOfWeek` (default FRIDAY) and `Org.reconcileOpensTime` (default 12:00); guard against next-occurrence | Phase 3 |
| P20 | Digest idempotency relies on app logic only | Unique index `(recipient_id, kind, payload_json->>'weekStart')` partial WHERE kind='WEEKLY_DIGEST' AND state IN ('SENT','PENDING') | Phase 6 |
| P25 | Phase 4 perf gate cannot pass without rollup | Phase 4 explicitly includes `MaterializedRollupJob` + V5 migration; perf test seeds + runs job before assertion | Phase 4 |
| P26 | Slack webhook misconfig degrades silently → demo risk | Startup `HealthIndicator` posts heartbeat; `/actuator/health/readiness` DOWN if Slack unreachable AND channel=slack | Phase 8 |

---

## Minor (queued)

| ID | Issue | Resolution | Priority |
|---|---|---|---|
| P17 | `/manager/digest/current` referenced as RTK endpoint but no UI consumer or Gherkin step | Hero card consumes `/manager/digest/current` (returns most recent T5 AIInsight or null); add Gherkin step | Phase 5c |
| P19 | Week N+1 derivation across DST/year-boundary undefined | `current.weekStart.atZone(orgTz).plusDays(7).truncatedTo(DAY)` — never plusWeeks | Phase 3 |
| P21 | RCDO admin component placement inconsistent | Move `RCDOTreeEditor` + `RCDONodeForm` to `packages/shared-ui/src/components/` for reuse | Phase 1 |

---

## New patches discovered during build

| ID | Issue | Resolution | Phase | Status |
|---|---|---|---|---|
| P27 | `@module-federation/vite` 1.1.10 (in PRD §7) is not on npm — earliest published is 1.12.x. | Pin to `1.14.5` (latest 1.14.x stable as of build-time). Both `apps/host/vite.config.ts` and `apps/weekly-commit-remote/vite.config.ts` consume it; singletons still come from `packages/shared-deps-versions.json` (P22). | Phase 0 | Applied |
| P28 | DemoSeeder Phase-1 stage volume (175 users, 12 teams, 144 SOs) is too large to land alongside the rest of Phase 1 without bloating the foundation PR; risk of Phase 1 timing out before AI surfaces are even on the radar. | Seed in two waves on `phase/1-foundation`: **(a) bootstrap** seed = 1 org + 3 demo users (IC/Manager/Admin) + 1 RC × 1 DO × 2 Outcomes × 4 SOs — sufficient for `@phase-1` Gherkin to pass and for the federation smoke test. **(b) full** seed (175 users / 12 teams / 144 SOs / 4 weeks of history / 4 deliberate dysfunctions) lands at the top of `phase/2-lifecycle` before any commit/lock work — that's also the first phase that *needs* historical week data, so the ordering is natural. The full seed remains the responsibility of `phase/1-foundation` per PRD §12 Phase 1 — it's just split across two PRs for review hygiene. | Phase 1 / Phase 2 | Applied |
| P29 | Coverage gates run per-package in Vitest (`thresholds: {lines:80}` in each `vitest.config.ts`). The PRD calls for ≥80% global Vitest coverage, but Nx aggregates across packages. Substituting per-package thresholds is stricter than the brief and matches how the test runner actually executes. | Each package's `vitest.config.ts` enforces ≥80% on its own files. CI fails if any package drops below the gate — strictly stronger than a global aggregate. | Phase 0 | Applied |
| P30 | Backend integration tests on macOS Docker Desktop fail because Testcontainers' bundled `docker-java` client negotiates API v1.32 while modern Docker Desktop requires ≥v1.44 (`BadRequestException Status 400: client version 1.32 is too old`). Bumping testcontainers to 1.21.3 didn't fix it; setting `DOCKER_API_VERSION=1.44` is ignored by the embedded client; the `desktop-linux` default socket is a CLI proxy that returns an empty `/info` body which all Testcontainers strategies reject. | Drop Testcontainers from the integration-test base and connect to a long-running Postgres instead (`docker-compose up -d` locally; GitHub Actions `services: postgres` in CI). Same realism, no API negotiation. The `PostgresIntegrationTestBase` now configures `spring.datasource.*` against `localhost:5432`. Swap path back to Testcontainers: revert this commit + bump docker-java when upstream catches up. | Phase 1 | Applied |
| P31 | P28 mandates full DemoSeeder expansion at the top of `phase/2-lifecycle` "before any commit/lock work" — but the four-weeks-of-locked-and-reconciled-history slice references the `Week` and `Commit` JPA entities that don't exist until V3 migration + entity classes ship inside Phase 2 itself. Hard ordering "seed first, then code" is impossible without the schema. | Split the P28 expansion into two commits within `phase/2-lifecycle`: **(a) directory expansion** (175 users / 12 teams / 144 SOs / team priority weights / manager hierarchy / dysfunction-team placement markers) lands in the patches commit at the top of the branch — uses only Phase-1 entities. **(b) week-and-commit history slice** (4 weeks of LOCKED+RECONCILED activity per IC, the four deliberate dysfunctions, carry-forward chains) lands as a follow-up commit immediately after the Week + Commit JPA entities are added. Both ship before the Phase-2 PR opens. The P28 promise — "full seed before lifecycle work" — is preserved at PR granularity, not commit granularity. | Phase 2 | Applied |
| P32 | P2 perf harness is scoped to `/api/v1/weeks/current` (Phase 2 endpoint) but `phase/2-lifecycle` may want the harness scaffold landed in the entry patches commit before the endpoint exists. | Land the Gradle `perfTest` task + `EndpointPerformanceTest` class skeleton in the entry patches commit; the class compiles and the task runs but the only assertion at first targets `/api/v1/me` (a Phase-1 endpoint) as a placeholder. When the `/weeks/current` endpoint ships later in the same branch, swap the URL and add the seeded-org assertion. The perf harness wiring is then verifiable end-to-end before the lock business logic merges, satisfying the P2 intent without an unbuildable scaffold. | Phase 2 | Applied |
| P33 | P18 mandates two Org reconcile-window fields (`reconcileOpensDayOfWeek` default `FRIDAY`; `reconcileOpensTime` default `12:00`). The columns can land in V3 alongside the week/commit tables (one migration is cleaner than V3 + V3.5) since both are part of the same Phase-2 surface. | Fold P18 columns into `V3__commits.sql` instead of opening V3.5. Keeps Flyway version count tight; both Phase-2 schema concerns live in one auditable migration. | Phase 2 | Applied |
| P34 | Phase 4 needs `team_rollup_cache`, but PRD §3.3 reserves V4 for the AI/notification surface (`ai_insight`, `notification_event`, `alignment_risk`, `ai_budget`, `ai_user_hour_counter`, plus the `WHERE … weekStart` partial index). Naming the rollup migration V4 would force Phase 5a to either renumber or split, while naming it V5 leaves V4 contiguous for Phase 5a. | Number the Phase-4 rollup-cache migration `V5__rollup_cache.sql`; reserve `V4__ai_and_notifications.sql` for Phase 5a's contiguous AI surface. The Flyway version table tolerates non-contiguous numbering, so introducing V5 before V4 is safe. | Phase 4 | Applied |
| P35 | The four-week LOCKED+RECONCILED history slice (P28 part b / P31) calls for `~15%` of `NOT_DONE` commits flagged carry-forward. The full carry-forward semantics (parent commit transitions to `CARRIED_FORWARD`, new commit spawned in week N+1 with `parentCommitId`) is reconcile-time business logic in `ReconcileService`. Reproducing that path inside the seeder for ~150 ICs × 4 weeks would re-implement reconcile-submit. | Seed marks the original commit `state=CARRIED_FORWARD` without spawning a child for the 15% random NOT_DONE flags — the `MaterializedRollupJob` only needs the count of `CARRIED_FORWARD` commits per team to populate the rollup payload. The Sarah Mendez 4-week chain is the only seeded path that builds an actual `parentCommitId` chain (because the 4-week-running insight depends on the lineage). Acceptable simplification; documented so the demo doesn't accidentally claim every random carry-forward has a child commit. | Phase 4 | Applied |
| P36 | DemoSeeder needed an explicit `@Order` to guarantee it runs before `DemoHistorySeeder`. Without `@Order`, both `CommandLineRunner` beans default to `LOWEST_PRECEDENCE` and Spring's tie-break order is undefined. | Annotate `DemoSeeder` with `@Order(10)` (foundation seed first) and `DemoHistorySeeder` with `@Order(20)` (history slice second). Both still gated by `@Profile("dev")` and the `throughline.seed.enabled` flag. | Phase 4 | Applied |

---

## Patch application protocol

1. Critical patches: applied inline in PRD.md before any code is written. This document records what was applied.
2. Important patches: each Phase begins with a checklist scan of patches tagged with that Phase. Apply before writing tests.
3. Minor patches: apply opportunistically; defer if scope-pressured.
4. New ambiguity discovered during build → add as a new patch (P27, P28…) here. Do not silently make decisions.

---

*End of patch document.*
