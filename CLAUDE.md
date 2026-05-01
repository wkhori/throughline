# CLAUDE.md

Operating manual for Claude Code agents working in this repository. Read in full before making changes.

---

## Project overview

Throughline is a production-ready micro-frontend that replaces 15Five for weekly planning. Every weekly commit is FK-linked to a Supporting Outcome inside the org's RCDO hierarchy (Rally Cry → Defining Objective → Outcome → Supporting Outcome), enforcing strategic alignment as a structural property rather than self-report. An AI Strategic Alignment Copilot operates across the weekly lifecycle to do the alignment work as a byproduct of planning, so the manager's default view is a pre-digested dashboard.

**Reframe that drives every feature decision:** manager attention is the scarce resource. Features are judged against *"does this reduce required manager attention without losing signal?"* If not, they do not ship.

**Differentiator:** the structured RCDO graph. AI features must exploit the graph (e.g. *"Outcome 3.2 received 47% of org effort this week, Outcome 3.1 received zero"*, *"this commit has been carry-forwarded four weeks running"*). Do not bolt on AI features that operate only on unstructured text — that is what 15Five already does.

---

## Repository layout

```
apps/
  host/                    Vite 5 + Module Federation host shell
  weekly-commit-remote/    Vite 5 + MF remote (the weekly commit module)
  marketing-video/         Remotion app preview rendered into the landing page
packages/
  shared-types/            Cross-package TS types
  shared-ui/               Shared Flowbite-extended components, design tokens
  shared-deps-versions.json   Single source of truth for MF singleton versions
services/
  api/                     Spring Boot 3.3 + Java 21 backend (Gradle)
infra/
  terraform/               AWS production-target IaC
  helm/                    Helm chart for the API
cypress/                   Cucumber/Gherkin .feature files + step defs
evals/                     Inline AI eval harness (substitute for @wkhori/evalkit)
docs/                      ADRs, AI copilot spec, source-control guide, etc.
```

The host renders the landing page, `/architecture` page, and mounts the remote at `/app`. The remote owns the entire weekly-commit lifecycle UI (IC view + Manager dashboard).

---

## Commands

All commands run from the repo root unless noted.

```bash
# Install
yarn install

# Dev (run in three terminals)
yarn db:up                 # Postgres 16 via docker compose
yarn dev:api               # Spring Boot on :8080
yarn dev:host              # MF host on :5173
yarn dev:remote            # MF remote on :5174

# Quality gates
yarn lint                  # ESLint 9 across all packages
yarn type-check            # tsc --noEmit across all packages
yarn test                  # Vitest unit tests across all packages
yarn format                # Prettier write
yarn format:check          # Prettier check (CI)

# E2E
yarn cypress open          # interactive
yarn cypress run           # headless

# Backend (run from services/api/)
./gradlew bootRun
./gradlew test             # JUnit + JaCoCo (≥80% gate)
./gradlew spotlessCheck spotbugsMain

# AI evals (hits real Anthropic API, requires ANTHROPIC_API_KEY)
yarn evals
```

---

## Architecture at a glance

- **Monorepo:** Yarn Workspaces + Nx. Two FE apps, one Remotion app, two shared packages, one Spring Boot service.
- **Module Federation:** Host and remote ship as two separate Vite 5 SPAs running `@module-federation/vite` 1.14.5 (the official MF-team plugin). The remote exposes `./App` → `apps/weekly-commit-remote/src/federated-entry.tsx`, a thin wrapper that brings its own Redux Provider + ApiBaseUrlProvider. The host federates it via `lazy(() => import('weekly_commit_remote/App'))` in `apps/host/src/components/RemoteBoundary.tsx`; the host's `/app` route mounts the federated remote in-process. Singleton versions (React, Redux, RTK, react-redux, react-router-dom, `@throughline/shared-ui`, `@throughline/shared-types`) come from `packages/shared-deps-versions.json`. The plugin manages chunk splitting internally (no `manualChunks` override); both apps target `esnext` for native top-level await. Both apps authenticate against the same Auth0 tenant — one shared JWT contract.
- **Backend:** Spring Boot 3.3 / Java 21 / PostgreSQL 16.4 / Hibernate-JPA / Flyway. Every entity extends `AbstractAuditingEntity`. All schema changes go through Flyway migrations in `services/api/src/main/resources/db/migration/` — never manual SQL.
- **API surface:** All FE↔BE traffic goes through RTK Query endpoints with `tagTypes` for invalidation. Raw `fetch` and `axios` are blocked by lint rule.
- **Auth:** Auth0 (OAuth2 / JWT, validated against JWKS). A mock decoder is wired alongside the live decoder so demo personas can sign in without an Auth0 account; the delegating filter accepts both.
- **AI:** Anthropic provider. Haiku for high-volume cheap calls, Sonnet for analytical work. Per-org token budget enforced server-side in `AnthropicClient.preflight()` (`PESSIMISTIC_READ` on `AIBudget`).
- **Notifications:** `NotificationChannel` adapter interface. `SlackChannel` (live), `OutlookGraphChannel` (stub — swap path documented in ADR row 33), `LogChannel` (tests). Channel selected by config.
- **Deployment:** Railway hosts the demo (host, remote, API, Postgres). AWS EKS/CloudFront/S3/SQS/SNS is the production target — Terraform in `infra/terraform/` is `terraform validate`-clean, Helm chart in `infra/helm/` is `helm lint`-clean. Swap path is documented in ADR row 32.

---

## Domain model

### RCDO hierarchy

`Rally Cry → Defining Objective → Outcome → Supporting Outcome → WeeklyCommit`

Every `WeeklyCommit` has a non-null FK to a `SupportingOutcome`. This is the load-bearing invariant — alignment is a property of the data model, not a downstream check.

### Lifecycle state machine

`DRAFT → LOCKED → RECONCILING → RECONCILED → CARRIED_FORWARD`

- **DRAFT** — IC writes commits, links each to a Supporting Outcome, places each on the chess layer (2D categorization × priority matrix). AI suggests Outcomes (T1) and flags drift (T2); commit-quality lint runs (T7).
- **LOCKED** — IC locks the week. No further plan edits. AI generates portfolio review (T3): over/under-investment by Outcome.
- **RECONCILING** — End of week. IC marks each commit done / partial / not done with notes.
- **RECONCILED** — Reconciliation submitted. AI generates alignment delta (T4). Manager digest (T5) fires.
- **CARRIED_FORWARD** — Terminal state on the original commit. Spawns a new DRAFT in week N+1 with `parentCommitId`, enabling *"carry-forwarded N weeks running"* insights.

Transitions are guarded server-side. The FE reflects state but never authorizes transitions.

---

## AI Copilot surface (T1–T7)

Full prompt text, JSON schemas, and fallbacks: `docs/ai-copilot-spec.md`.

| Touchpoint | Lifecycle stage | Model | Purpose |
|---|---|---|---|
| T1 Outcome suggestion | DRAFT | Haiku | Suggest the right Supporting Outcome for a commit. |
| T2 Drift warning | DRAFT | Haiku | Flag commits that don't fit their linked Outcome. |
| T3 Portfolio review | LOCKED | Sonnet | Over/under-investment across the RCDO graph. |
| T4 Alignment delta | RECONCILED | Sonnet | Shipped, slipped (with cause), carry-forward recommendations. |
| T5 Manager digest | Manager (post-reconcile) | Sonnet | Pre-digested weekly summary, dispatched via notification adapter. |
| T6 Alignment-risk alert | Manager (background) | Haiku | Hourly scan for alignment risk; pages only on flagged exceptions. |
| T7 Commit-quality lint | DRAFT | Haiku | Cheap inline lint as the IC types. |

---

## Conventions

### Frontend

- TypeScript strict mode. ESLint 9 + Prettier 3.3 must pass.
- **Tailwind v4 canonical syntax only:** `bg-(--color-name)` not `bg-[var(--color-name)]`; `bg-linear-to-r` not `bg-gradient-to-r`; scale-divided spacing (`h-150` not `h-[600px]`); no arbitrary values where a scale value exists. Run `npx prettier --write <file>` after editing files with Tailwind classes.
- **Component library:** Flowbite React, extended with Tailwind. Do not introduce alternative component libraries.
- **State / data:** All server interactions through RTK Query endpoints with `tagTypes` for invalidation. No raw `fetch`, no `axios`, no manual thunks. Lint rule enforces this.

### Backend

- Java 21. Spring Boot 3.3.
- All entities extend `AbstractAuditingEntity` (createdBy / createdDate / lastModifiedBy / lastModifiedDate).
- Spotless + SpotBugs must pass. JaCoCo coverage ≥ 80%.
- Flyway for every schema change. Never write manual `ALTER TABLE` against a live DB.

### Tests

- Vitest unit tests for every component.
- Cypress + Cucumber/Gherkin `.feature` files for E2E acceptance scenarios — treated as deliverable spec artifacts.
- AI evals run against the real Anthropic API via `evals/runner.ts`: temperature 0, N=3, ≥2/3 pass, deterministic assertions. Substitute for `@wkhori/evalkit` (ADR row 34).

### Commits

- Conventional-commit prefixes: `feat | fix | test | docs | refactor | chore | perf` with scope.

---

## Decision-making protocol

This project has a fixed brief (`project-brief.md`) with a long, partially-redundant tech-stack list. Every architectural decision falls into one of four treatments, recorded in `docs/architecture-decisions.md`:

1. **Implement as specified.** Brief requirement, no deviation.
2. **Substitute** — implement the intent with a different mechanism. Document rationale and swap path.
3. **Out of scope** — drop. Document why and the condition under which it would be picked up.
4. **Additional** — add capability not in the brief, when it materially serves the problem statement (e.g. the AI Strategic Alignment Copilot, the per-org Anthropic budget guard, the inline eval harness). Document why it earns its place.

`docs/architecture-decisions.md` is the source of truth for applied decisions. **Update the ADR before deviating from the brief or adding new capability**, not after. If a decision is not in the ADR, it has not been made.

If the brief and the ADR conflict, the ADR wins for *applied* decisions. The brief wins for *unstated* decisions (default to it).

### Known substitutions (see ADR for full list)

| Brief requirement | Substitute | ADR row |
|---|---|---|
| AWS (EKS / CloudFront / S3 / SQS / SNS) | Railway for demo; Terraform + Helm in `infra/` as the production swap path | 32 |
| Outlook Graph API integration | `NotificationChannel` adapter; Slack live, Outlook stub | 33 |
| `@wkhori/evalkit` (per CLAUDE.md / AI spec) | Inline harness in `evals/runner.ts` honouring the same contract | 34 |
| Playwright | Cypress + Cucumber/Gherkin (brief also requires Cypress; one E2E framework) | 11 |

---

## Where things live

- `project-brief.md` — original brief, verbatim.
- `docs/architecture-decisions.md` — every applied decision and its rationale.
- `PRD.md` — phase-by-phase build plan.
- `docs/prd-patches.md` — gap-audit patches by phase.
- `docs/ai-copilot-spec.md` — T1–T7 prompts, schemas, fallbacks, eval harness contract.
- `infra/README.md` — AWS swap path detail.
- `evals/last-run.md` — most recent eval results.
- `README.md` — what it is, demo URL, run instructions.
