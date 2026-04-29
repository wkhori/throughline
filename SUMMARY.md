# Project Summary — Weekly Commit Module

A condensed review document of every decision made during planning. Read this end-to-end to verify alignment before build kicks off. Detailed source-of-truth lives in: `project-brief.md`, `CLAUDE.md`, `PRD.md`, `docs/architecture-decisions.md`, `docs/ai-copilot-spec.md`, `docs/prd-patches.md`.

---

## What We're Building

A production-ready micro-frontend that replaces 15Five for weekly planning. Every weekly **commit** (a sentence-length work item from an IC) is FK-linked to a **Supporting Outcome** in a strategic graph: **Rally Cry → Defining Objective → Outcome → Supporting Outcome (RCDO)**. The system enforces a complete lifecycle — `DRAFT → LOCKED → RECONCILING → RECONCILED → CARRIED_FORWARD` — and an **AI Strategic Alignment Copilot** assists at every transition.

---

## The Two Frames That Drive Every Decision

1. **Manager-burden reduction is the design spine.** ICs + AI copilot do the alignment work as a natural byproduct of planning. Managers see a pre-digested AI dashboard. They drill in only on flagged exceptions. Every feature judged against: *does this reduce required manager attention without losing signal?*

2. **Differentiation vs. 15Five is structural, not "we have AI."** 15Five operates on unstructured check-in text. We operate on a structured RCDO graph. Our AI generates insights 15Five structurally cannot — *"Outcome 3.2 received zero commits org-wide for two weeks running"*, *"this commit has been carry-forwarded four weeks running."*

---

## The Rule for Every Brief Requirement

Every requirement gets exactly one of three treatments:

1. **Implement as specified** — no deviation.
2. **Substitute** — implement intent with a different mechanism, document why and the swap path back.
3. **Out of scope** — drop, document why.

No silent skips. No silent expansions. The 33-row table in `docs/architecture-decisions.md` applies this Rule to every brief line.

---

## Substitutions (only two)

| Brief requirement | What we're shipping | Why | Swap path |
|---|---|---|---|
| AWS (EKS / CloudFront / S3 / SQS / SNS) | Railway demo + production-grade Terraform skeleton in `infra/` | Live URL + IaC sends a stronger signal than a half-finished EKS cluster on a 4-hour clock | `terraform apply` + ECR push + Helm install — runnable, not pseudocode |
| Outlook Graph API | Slack via `NotificationChannel` adapter; `OutlookGraphChannel` exists as a stub | Slack matches the real user need (async digests where managers already work); Outlook tenant friction adds nothing | Implement the stub, flip config — one file change |

## Out of Scope (one)

**Playwright.** Removed in favor of Cypress + Cucumber/Gherkin alone — the brief's *Code Quality Standards* line is more specific than the *Development Tools* mention; two E2E frameworks for the same job is dilution, not coverage.

---

## The AI Copilot — Six Lifecycle Touchpoints

| ID | When | Model | Cost/call | What it does |
|---|---|---|---|---|
| **T1 Outcome Suggestion** | IC types commit text (debounced) | Haiku 4.5 | ~0.06¢ | Suggests the most likely Supporting Outcome with confidence + rationale |
| **T2 Drift Warning** | Commit linked to an Outcome | Haiku 4.5 | ~0.09¢ | Scores drift; warns + suggests fix if commit doesn't actually advance the picked outcome |
| **T3 Portfolio Review** | DRAFT → LOCKED | Sonnet 4.6 | ~1.4¢ | Reviews the locked week as a portfolio: over/under-investment, chess-grid balance, alignment to team priority signal |
| **T4 Alignment Delta** | RECONCILING → RECONCILED | Sonnet 4.6 | ~2.0¢ | Shipped, slipped (with cause), carry-forward recommendations, outcome traction delta |
| **T5 Manager Digest** | Cron Friday 16:00 + on-demand | Sonnet 4.6 | ~3.2¢ | Manager-attention digest: alignment headline, starved Outcomes, drift exceptions, drill-downs. Slack + dashboard hero |
| **T6 Alignment-Risk Alert** | Hourly background scan | Haiku 4.5 | ~0.13¢ | Severity-tagged alert with affected entities + suggested manager action |

**Org-level monthly cost projection** (175 employees, 4 weeks): **~$46/mo** ($0.26 per employee/month). Soft cap $250/mo, hard cap $500/mo.

**Cost guards (server-side):** per-user-per-hour caps (T1 ≤30/hr), per-user-per-day caps, org soft/hard cap via `PESSIMISTIC_READ` on `AIBudget`. Cache reads at 0.10× input cost. Frontend never sees budget data; only handles 429 by silent degrade.

**Fallback discipline:** every AI surface has a "service unavailable" path that does not block the user. Locks proceed, reconciliations submit, the manager dashboard always renders. AI is enhancement, never a gate.

---

## Lifecycle State Machine

States: `DRAFT → LOCKED → RECONCILING → RECONCILED`. Per-commit terminal: `CARRIED_FORWARD`.

- **DRAFT**: IC adds commits, links each to a Supporting Outcome, places each on the **chess matrix** (2D: category × priority). Max 7 commits/week.
- **LOCK**: requires ≥1 commit and every commit has a Supporting Outcome. Triggers T3 Portfolio Review. Lock is idempotent on terminal LOCKED — replaying returns the prior snapshot, no second AI call.
- **RECONCILING**: opens after `Org.reconcileOpensDayOfWeek` (default Friday 12:00 org-tz).
- **RECONCILED**: each commit marked done/partial/not-done with notes (≤1000 chars). Triggers T4 Alignment Delta. Strict % and weighted % both reported.
- **CARRIED_FORWARD**: terminal on the original commit. New DRAFT spawns in week N+1 with `parentCommitId`. Lineage queryable via recursive CTE. 7-commit cap respected.

---

## Architecture at a Glance

- **Monorepo:** Yarn Workspaces + Nx.
- **Frontend host:** `apps/host/` — Vite 5 + React 18, Auth0 SPA SDK, owns Auth and pushes JWT into shared Redux slice.
- **Frontend remote:** `apps/weekly-commit-remote/` — Vite Module Federation remote (`@module-federation/vite`), exposes `WeeklyCommitApp` + `api-slice`, reads JWT via shared store.
- **Shared packages:** `packages/shared-ui/` (singleton across federation — auth slice, design tokens, `AIInsightPanel`, `CommitCard`, `RCDOPicker`, etc.) and `packages/shared-types/`.
- **Backend:** `services/api/` — Spring Boot 3.3, Java 21, JPA/Hibernate, Flyway, PostgreSQL 16.4, Auth0 JWT (with explicit audience validator — Spring's gotcha), `@TransactionalEventListener(AFTER_COMMIT)` async dispatch.
- **AI integration:** `infrastructure/ai/AnthropicClient` (OkHttp + Jackson) with prompt-cache headers, retries, server-side cost guards, deterministic fallbacks.
- **Notifications:** `NotificationChannel` adapter (`SlackChannel` live, `OutlookGraphChannel` stub, `LogChannel` for tests).
- **Infra:** Railway demo (4 services: host, remote, api, postgres). Production target on AWS as runnable Terraform in `infra/terraform/`.

---

## Tech Stack (verified versions, April 2026)

| Area | Stack |
|---|---|
| Frontend | TypeScript strict, React 18, Vite 5, `@module-federation/vite`, Redux Toolkit + RTK Query (singleton), Flowbite React on Tailwind v4, `@dnd-kit/core` for chess matrix |
| Backend | Java 21, Spring Boot 3.3, Spring Security 6 (resource server JWT), Spring Data JPA, Hibernate, Flyway, PostgreSQL 16.4 |
| Tests | Vitest (FE), JUnit 5 + Cucumber-Spring (BE), Cypress + `@badeball/cypress-cucumber-preprocessor` v22 (E2E) |
| Quality gates | ESLint 9, Prettier 3.3, Spotless, SpotBugs, JaCoCo ≥80%, Vitest ≥80% |
| AI | Anthropic API — Haiku 4.5 ($1/$5 per 1M), Sonnet 4.6 ($3/$15), prompt caching at 0.10× read |
| Auth | Auth0 dev tenant, OAuth2 JWT, audience validator, `permissions` claim → authorities |
| Notifications | Slack Block Kit incoming webhook (rate-limit-aware), Outlook Graph stub |
| Deploy | Railway (4 services); Terraform + Helm + GH Actions for AWS production swap |

---

## Test Discipline (SDD + TDD by Construction)

Every phase begins by writing the test layer **before** implementation:

1. **Cypress + Cucumber/Gherkin `.feature` files** — 16 feature files; full text per phase. Tags `@phase-N`, `@ai`, `@ai-fallback`, `@happy-path`, `@edge`, `@regression`, `@perf`. **`.feature` files are deliverable spec artifacts**, not just tests.
2. **Spring `@WebMvcTest` contract tests** — every endpoint × {happy 2xx, validation 400, auth 401, forbidden 403, not-found 404, illegal-state 409, server error 500}. ~120 tests.
3. **Vitest component tests** — render, props variants, interactions, RTK Query loading/error, AI fallback. ~150 tests.
4. **Eval harness** — 5 scenarios in `evals/fixtures/` against real Anthropic API; runs on `prompts`-labeled PRs and nightly on `main`.

CI fails on any coverage regression below 80% on either FE or BE.

---

## Phased Build Plan

Each phase ships independently with its tests gating exit. **Phase 5 split into 5a/5b/5c after a gap audit identified slip risk in bundling six AI surfaces.**

| Phase | What lands |
|---|---|
| **0** | Repo bootstrap — Nx + Yarn workspaces, configs, baseline CI |
| **1** | Auth (Auth0 + scope check) + Schema (V1, V2) + RCDO admin authoring + **DemoSeeder Phase 1 stage** + MF singleton smoke test |
| **2** | Weeks + Commits + Chess layer + DRAFT→LOCKED state machine; perf gate <200ms via `perfTest` Gradle task |
| **3** | Reconciliation + Carry-forward + lineage; Friday reconcile-open timing |
| **4** | Manager Dashboard + materialized rollup cache + 2000-record perf gate + manager-scope authorization |
| **5a** | Anthropic infra + cost guards + T1 (Outcome suggestion) + T2 (Drift) — Haiku surfaces |
| **5b** | T3 (Portfolio) + T4 (Delta) + websocket fallback + deterministic fallbacks — Sonnet sync |
| **5c** | T5 (Manager digest) + T6 (Alert) + alert dedupe + ack endpoint — manager surfaces |
| **6** | Notification adapter + Slack live + scheduled jobs + idempotency |
| **7** | Metrics (`/metrics/org`) + Linear-grade UI polish + accessibility + perf |
| **8** | Railway deploy + Auth0 prod URLs + Terraform skeleton runnable + Slack health check |

---

## Seed Data — Deliberate Dysfunction

Demo lives or dies on whether the AI dashboards immediately show signal. The `DemoSeeder` (175 employees, 12 teams, 4 weeks of history) bakes in **four pre-set issues**:

1. **Starved Outcome** — *"Expand enterprise pipeline Q2"* has zero commits org-wide for 2 consecutive weeks → triggers T6.
2. **4-week carry-forward** — Sarah Mendez's *"Refactor billing service test suite"* lineage chain length 5 → triggers T6 HIGH.
3. **Drifting team** — *"Platform Reliability"* 65% concentrated on a single Outcome vs. team priority signal expecting 30–50% spread → triggers T6.
4. **Over-indexed manager** — Jordan Kim's 6/8 reports on the same Outcome → manager digest highlights this.

Demo accounts: `ic@demo.throughline.app`, `manager@demo.throughline.app`, `admin@demo.throughline.app`.

---

## Documentation Surface (Deliverables)

| File | Audience | Purpose |
|---|---|---|
| `README.md` | Everyone | Demo URL, run-locally, env vars, accounts |
| `CLAUDE.md` | Reviewer | Methodology, the Rule, manager-burden reframe |
| `PRD.md` | Build reference | The build script — every section drives a phase |
| `docs/architecture-decisions.md` | Reviewer | The 33-row requirement-treatment table; substitution rationale |
| `docs/ai-copilot-spec.md` | Build reference | Full prompt text, JSON schemas, fallbacks, evals |
| `docs/prd-patches.md` | Build reference | 26 patches from the gap audit — 10 critical applied inline, 12 important per-phase, 4 minor queued |
| `/architecture` (host page) | Reviewer | System diagram, MF contract, AI data flow — rendered from `apps/host/src/architecture/` |
| `infra/README.md` | Operations | Railway → AWS swap path |

---

## Submission Artifacts

1. **Hosted app URL** (Railway).
2. **Repo URL** (GitHub).
3. **CLAUDE.md** — verbatim copy.

The reviewer's expected reading order: `CLAUDE.md` → `docs/architecture-decisions.md` → `README.md` → live demo → tests → `infra/`. Every one of those is a first-class artifact.

---

## Things You Should Verify Before Build Starts

1. **The framing.** Manager-burden reduction is the spine; structured-graph-AI vs unstructured-text-AI is the differentiation vs 15Five. Both alignments held throughout planning.
2. **The substitutions.** Railway + Terraform vs full EKS; Slack vs Outlook Graph. Both documented with swap paths.
3. **The chess layer interpretation.** 2D matrix (category × priority) — confirmed, not a 1D pipeline.
4. **The carry-forward modeling.** Original commit → CARRIED_FORWARD terminal; new DRAFT in week N+1 with `parentCommitId`. Confirmed.
5. **The cost ceiling.** $46/mo at 175 employees with caching. Hard cap $500/mo. Server-side enforcement. Confirmed.
6. **The Phase 5 split.** Six AI surfaces in one phase was a slip risk; split into 5a/5b/5c after the gap audit.
7. **The seed dysfunctions.** Four baked-in issues so AI dashboards show signal on first demo login. Confirmed.
8. **No time estimates anywhere.** Phase sizing by scope, not duration. Confirmed.

If any of the eight above feels off, flag it before Phase 0 starts. After that, the PRD is the contract.
