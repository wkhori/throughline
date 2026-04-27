# Throughline — Weekly Commit Module

Production-ready micro-frontend that replaces 15Five for weekly planning.
Every weekly commit is FK-linked to a Supporting Outcome inside the org's
RCDO hierarchy (Rally Cry → Defining Objective → Outcome → Supporting Outcome),
enforcing strategic alignment as a structural property — not a self-report.

> **Required reading for any contributor:** [`CLAUDE.md`](./CLAUDE.md). It is
> also a project deliverable — the hiring reviewer reads it to understand how
> the build was driven.

## Why this exists

The brief: 15Five collects weekly check-ins as unstructured text; managers
infer alignment manually. Manager attention is the scarce resource. The IC +
AI copilot do the alignment work as a natural byproduct of planning. The
manager's default view is a pre-digested strategic dashboard. They drill in
only when the AI flags something worth their attention.

## Differentiation vs. 15Five

15Five operates on unstructured text. Throughline operates on a **structured
strategy-to-execution graph** — every commit is FK-linked to a Supporting
Outcome. The AI generates insights 15Five structurally cannot:

- *"Outcome 3.2 received 47% of org effort this week, Outcome 3.1 received
  zero."*
- *"This commit has been carry-forwarded four weeks running."*
- *"Sarah's portfolio is 71% concentrated on a single Outcome while team
  priority signal expects 30–50% on enterprise."*

## Repo layout

```
apps/host                       # Module Federation host (React 18 + Vite 5)
apps/weekly-commit-remote       # Module Federation remote (the actual app)
packages/shared-ui              # Federation singleton: store, hooks, components
packages/shared-types           # Backend DTO mirrors
packages/shared-deps-versions.json  # Single source of truth for MF singletons (P22)
services/api                    # Spring Boot 3.3, Java 21, JPA, Flyway
docs/                           # Decisions, AI spec, patches, source-control, orchestration
infra/                          # Terraform (AWS swap path) + Helm chart   [Phase 8]
cypress/                        # Cucumber/Gherkin acceptance specs        [per phase]
evals/                          # AI eval harness (@wkhori/evalkit)        [Phase 5]
```

## Run locally

Prerequisites: Node 22.17.x (`.nvmrc`), Yarn 1.22+, Java 21, Docker.

```bash
yarn install
docker compose up -d                        # Postgres 16.4 on :5432
cp .env.example .env.local                  # then fill what you have
cd services/api && ./gradlew bootRun        # backend on :8080
cd ../.. && yarn dev:remote                 # remote on :5174
yarn dev:host                               # host on :5173 → open http://localhost:5173
```

### Continue-and-defer (no credentials? still runs)

The build never blocks on missing credentials. Stub providers activate
automatically:

| Credential        | When unset                                     |
|-------------------|------------------------------------------------|
| `AUTH0_*`         | `MockJwtDecoder` + `MockAuth0Provider`         |
| `ANTHROPIC_*`     | `StubAnthropicClient` (deterministic fixtures) |
| `SLACK_WEBHOOK_*` | `LogChannel` (logs to SLF4J INFO)              |

Drop real values into `.env.local` whenever convenient; integration tests
flip green automatically. See [`docs/orchestration-plan.md`](./docs/orchestration-plan.md).

## Tests

- **Backend.** JaCoCo ≥80% line coverage. `./gradlew check` runs unit +
  contract + Cucumber suites.
- **Frontend.** Vitest ≥80% lines/branches/functions/statements. `yarn nx run-many -t test`.
- **E2E acceptance.** Cypress + Cucumber/Gherkin. `.feature` files in
  `cypress/e2e/**` are **deliverable spec artifacts**, not just tests.
- **AI evals.** `@wkhori/evalkit` against real Anthropic API. Stub-mode fixtures
  ship in `evals/fixtures/{t1..t7}/`. See `docs/ai-copilot-spec.md` §Eval Harness.

## Deliverables

1. Hosted demo URL (Railway).
2. This repo.
3. [`CLAUDE.md`](./CLAUDE.md).

## Methodology + decisions

- [`CLAUDE.md`](./CLAUDE.md) — methodology, the Rule, manager-burden reframe.
- [`docs/architecture-decisions.md`](./docs/architecture-decisions.md) — 33-row requirement-treatment table.
- [`PRD.md`](./PRD.md) — phase-by-phase build script.
- [`docs/prd-patches.md`](./docs/prd-patches.md) — 26 gap-audit patches.
- [`docs/ai-copilot-spec.md`](./docs/ai-copilot-spec.md) — full AI prompts, schemas, evals.
- [`docs/source-control-guide.md`](./docs/source-control-guide.md) — branching, commits, PRs.
- [`docs/orchestration-plan.md`](./docs/orchestration-plan.md) — execution contract.
