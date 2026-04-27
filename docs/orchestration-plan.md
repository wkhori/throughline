# Orchestration Plan

Audience: the **main implementing Claude session** building this project. This document is the working contract — read it once at session start, follow it through to submission.

---

## Pre-flight (one-time, before kickoff)

**User has confirmed ready:**
- Docker installed and running locally.
- Railway CLI installed and authenticated (`railway whoami` returns the user).
- Slack: a private channel in an existing workspace will be used (webhook URL pasted into `.env.local` mid-build). Owner is the user; channel is invite-only.

**Credentials provided by the user asynchronously, NOT at phase boundaries:**

The agent **never blocks waiting for credentials**. Every external dependency has a stub provider so development continues uninterrupted. When the user adds a credential to `.env.local`, the integration smoke for that component flips green in the next phase boundary or as a one-line follow-up commit.

| Credential | Stub strategy | Real-integration smoke fires |
|---|---|---|
| **Auth0** (`AUTH0_*`, `VITE_AUTH0_*`) | `MockAuth0Provider` injects a synthetic JWT into the shared auth slice; backend `JwtDecoder` wired to a `MockJwtDecoder` under `dev` profile when `AUTH0_ISSUER_URI` is unset. All `auth/*.feature` and contract tests run against the mock. | Phase 1 once user pastes Auth0 vars; switches `dev` profile to use real Auth0 issuer. |
| **Anthropic** (`ANTHROPIC_API_KEY`) | `StubAnthropicClient` returns deterministic fixture JSON keyed by prompt template name + input hash. T1–T7 contract tests + Cypress `@ai` scenarios run against the stub. Eval harness emits "ANTHROPIC_API_KEY not set; skipping E1–E7 in evals/" warning, exits 0, does not fail CI. | Phase 5a once user pastes key; eval harness flips to real-API mode automatically. |
| **Slack** (`SLACK_WEBHOOK_URL`) | `LogChannel` (already specified) when `NOTIFICATION_CHANNEL` is unset or set to `log`. All `notifications/*.feature` scenarios assert against the LogChannel record. | Phase 6 once user pastes webhook URL; `NOTIFICATION_CHANNEL=slack` in `.env.local` flips channel selection. |
| **Railway** (`RAILWAY_TOKEN` etc.) | Local `docker compose up` covers backend + Postgres + frontend dev servers. Tests against `localhost`. | Phase 8 — agent runs `railway init` directly using the user's already-authenticated CLI. No env var paste needed. |

**Continue-and-defer rule (replaces pause-and-prompt):**

When the agent hits a missing credential:
1. Agent **does not stop**. Implementation continues using the stub provider.
2. Agent appends one line to `docs/env-deferred.md` listing: env var name, what it gates, file paths with `// TODO(env): <VAR>` markers added, the smoke test that will flip when credential lands.
3. Agent posts a one-line update in its progress report: *"deferred: ANTHROPIC_API_KEY (3 TODO markers, 1 smoke test)"*.
4. Agent moves on.

When the user adds a credential to `.env.local`:
5. The user posts: *"ANTHROPIC_API_KEY now in .env.local"*.
6. Agent runs the relevant smoke test, deletes the matching `// TODO(env)` markers, removes the row from `docs/env-deferred.md`, commits as `chore(env): wire real ANTHROPIC_API_KEY`, continues current phase.

**Forbidden under this rule:**
- Stopping the build for a credential.
- Falsely passing a test that requires the real provider — every stub-backed test is tagged `@stub`; every real-integration test is tagged `@integration` and skipped automatically when the credential is unset.
- Hard-coding credentials anywhere except `.env.local` (gitignored).

This means the user can launch the kickoff prompt now, walk away, and add credentials whenever convenient — the agent will fold them in mid-build with no friction.

### Test discipline under deferred credentials (binding)

Two-phase testing for every external dependency:

**Phase A — Stub-mode E2E coverage (during deferred state).**
- Every Cypress feature, every backend contract test, every Vitest test runs against the stub provider end-to-end. Coverage gates apply (JaCoCo ≥80%, Vitest ≥80%) — stubs do NOT exempt code from coverage.
- Stub fixtures must be representative: an Auth0 stub returns realistic `permissions` claims; the Anthropic stub returns valid JSON matching every output schema in `docs/ai-copilot-spec.md`; the LogChannel records messages that assertions read.
- Every flow the user would do in production must complete green via stubs *before* a phase's PR is opened. "It will work when the real key lands" is not acceptable — the stub must prove the integration shape is correct.
- Tag every stub-backed scenario `@stub`. Tag every test that *requires* the real provider `@integration`. Both must exist for every external surface.

**Phase B — Real-integration re-test (after credential lands).**
- When a credential is added to `.env.local` and the user posts `<VAR> now in .env.local`:
  1. Agent flips the relevant config (`AUTH0_ISSUER_URI` set → real `JwtDecoder`; `ANTHROPIC_API_KEY` set → real client; `SLACK_WEBHOOK_URL` + `NOTIFICATION_CHANNEL=slack` set → SlackChannel).
  2. Agent runs the full `@integration`-tagged suite for that surface, not just one smoke. Every prior `@stub` flow must have an `@integration` twin and both must pass.
  3. Agent runs the eval harness (for `ANTHROPIC_API_KEY`) at full N=3, ≥2/3 pass per scenario.
  4. Agent runs a manual smoke check via `curl` or `gh api` against a live endpoint that exercises the real provider.
  5. Agent logs results in the PR body (or a follow-up commit if the originating PR is already merged).

**Final pre-submission gate.** Before tagging `v0.1.0` and notifying the user the demo is ready:
- All `@stub` scenarios green.
- All `@integration` scenarios green against real providers.
- Eval harness E1–E7 green at N=3, ≥2/3.
- One end-to-end manual demo pass: log in via Auth0 → admin authors RCDO → IC drafts week with AI suggestions → IC locks → AI portfolio review fires → IC reconciles Friday → AI alignment delta fires → Monday digest posts to Slack channel → manager dashboard shows digest hero card with drill-downs working.

If any of the above is red, the build is not done — regardless of merged PRs.

---

## 0. Kickoff prompt

Paste this verbatim into a fresh Claude Code session in `/Users/walidkhori/Desktop/throughline/`:

```
You are the implementing agent for the Throughline Weekly Commit Module. This project has been fully planned. Your job is to execute the plan, not redesign it.

LOCKED INPUTS (read all four before writing any code):
1. /Users/walidkhori/Desktop/throughline/CLAUDE.md — methodology, the Rule, manager-burden reframe. Required reading.
2. /Users/walidkhori/Desktop/throughline/PRD.md — the build script. ~1,500 lines, drivable phase-by-phase.
3. /Users/walidkhori/Desktop/throughline/docs/architecture-decisions.md — 33-row requirement-treatment table. Every decision is final.
4. /Users/walidkhori/Desktop/throughline/docs/prd-patches.md — 26 patches from gap audit. 10 critical applied inline; 12 important per-phase; 4 minor queued.

ALSO READ:
5. /Users/walidkhori/Desktop/throughline/docs/ai-copilot-spec.md — full prompt text + schemas + fallbacks for T1–T7.
6. /Users/walidkhori/Desktop/throughline/docs/source-control-guide.md — branching model, commit cadence, PR workflow.
7. /Users/walidkhori/Desktop/throughline/docs/orchestration-plan.md — this file.

HARD RULES (non-negotiable):
- Follow the Rule from CLAUDE.md: every brief requirement is implement / substitute / out-of-scope. No silent skips, no silent expansions.
- SDD + TDD by construction: each phase begins with the test layer (Gherkin + contract stubs + Vitest list), then implementation, then verification.
- Coverage gates: JaCoCo ≥80%, Vitest ≥80%. CI must be green before opening a PR.
- One commit per logical unit. Conventional commits. No `--no-verify`. No `Co-Authored-By` lines.
- 5 branches total per docs/source-control-guide.md. Branch-per-cluster, not branch-per-phase.
- No RAG. No embeddings. No Pinecone. The differentiation is structured-RCDO-graph + AI summarization, not retrieval-augmented anything.
- Do NOT propose alternatives to locked decisions. If you discover ambiguity, log a new patch in docs/prd-patches.md and apply it; do not silently decide.

ENVIRONMENT (already prepared by the user):
- Docker is installed and running. Use `docker compose up -d` from the repo root once docker-compose.yml exists in Phase 0.
- Railway CLI is authenticated (`railway whoami` works). You will use it directly in Phase 8 — no env var paste needed.
- Slack: user has a private digest channel in their workspace; webhook URL will land in `.env.local` whenever convenient.
- Auth0 dev tenant: credentials will land in `.env.local` whenever convenient.
- Anthropic API key: will land in `.env.local` whenever convenient.

CONTINUE-AND-DEFER RULE (non-negotiable): NEVER stop the build for a missing credential. Every external dependency has a stub provider. When a credential is missing:
1. Use the stub provider (MockAuth0Provider / StubAnthropicClient / LogChannel / local Docker).
2. Append the deferred item to docs/env-deferred.md (create it if it doesn't exist).
3. Tag stub-backed tests `@stub` and real-integration tests `@integration` (auto-skipped when credential unset).
4. Post a one-line "deferred: <VAR>" note in the progress report.
5. Move on.

TWO-PHASE TESTING (binding):
- Phase A (stub-mode): every Cypress feature, every backend contract test, every Vitest test must run end-to-end against stubs. Coverage gates apply unchanged. Stubs return schema-valid fixtures so every integration shape is proven before real credentials arrive. Every flow tagged `@stub`.
- Phase B (real-integration): when the user posts "<VAR> now in .env.local", flip the relevant config and run the full `@integration`-tagged suite for that surface — every `@stub` flow must have an `@integration` twin, both green. For `ANTHROPIC_API_KEY` also run eval harness E1–E7 at N=3, ≥2/3 pass. Run a manual curl/gh smoke against a live endpoint. Log results in PR body or a follow-up commit.

Final pre-submission gate: all `@stub` green + all `@integration` green + evals green + one full manual demo pass (Auth0 login → RCDO authoring → draft → AI suggestions → lock → portfolio review → reconcile → alignment delta → Slack digest → manager dashboard with drill-downs). Any red = build not done.

Forbidden: stopping for a credential; falsely passing a test that requires the real provider; hard-coding credentials anywhere except `.env.local` (gitignored); shipping if `@integration` suite is missing or red.

START COMMAND:
1. Read all 7 files above in order.
2. Run `git status` and `git log --oneline -5` to confirm starting state.
3. Run `docker --version` and `railway whoami` to confirm tooling.
4. Create branch `phase/1-foundation` from `main`.
5. Begin Phase 0 (repo bootstrap). Phase 0 + Phase 1 land in the same PR on this branch.
6. Continue through every phase using the continue-and-defer rule. Do NOT pause for credentials. Do NOT ask for credentials. Just defer and proceed.
7. Follow the per-phase entry checklist from docs/orchestration-plan.md §4 at the top of every phase.

Report progress at the end of each phase: which Gherkin scenarios pass, which patches were applied, coverage numbers, any new patches added to docs/prd-patches.md, and any items added to docs/env-deferred.md.
```

---

## 1. Order of operations

Sequential by default. The 5 branches map to 9 PRD phases as follows:

```
Branch: phase/1-foundation    → Phase 0 → Phase 1                    → PR → main
Branch: phase/2-lifecycle     → Phase 2 → Phase 3                    → PR → main
Branch: phase/3-manager       → Phase 4                              → PR → main
Branch: phase/4-ai            → Phase 5a → Phase 5b → Phase 5c       → PR → main
Branch: phase/5-deploy        → Phase 6 → Phase 7 → Phase 8          → PR → main
```

Within each branch:

1. Branch from latest `main`. `git checkout -b phase/X-name`.
2. Read the PRD section for the phase you're entering.
3. Read patches in `docs/prd-patches.md` tagged with that phase. Apply before writing code.
4. Write the test layer first (Gherkin + contract stubs + Vitest names).
5. Implement.
6. Run lint + type-check + tests locally. CI green.
7. Open PR per `docs/source-control-guide.md` template.
8. Self-merge. Delete branch.
9. Move to next branch.

---

## 2. Parallelism — only when blocked

The default is sequential. Only invoke parallelism if the main agent is **actively blocked** (e.g., waiting on a long CI run, a long Anthropic eval, or a long build).

Two genuine parallel opportunities:

### Opportunity A: AI Phase 5a + Notifications Phase 6

While the main agent builds AnthropicClient + cost guards + T1/T2/T7 on `phase/4-ai`, a sub-agent can scaffold `NotificationChannel` interface + `SlackChannel` impl + `LogChannel` + idempotency unique index on `phase/5-deploy`. They share zero files; merge order is 4-ai then 5-deploy.

### Opportunity B: AI Phase 5c + Notifications channel finalization

T5/T6 generate notifications; the channel adapter must already exist. If channel adapter scaffolding (Opportunity A) ran ahead, Phase 5c integrates against it directly.

**Do not parallelize anything else.** Phase 1→2→3 is strictly linear (auth + schema must exist before lifecycle; lifecycle must exist before manager dashboard).

### Parallelism mechanics

```bash
# Main agent on phase/4-ai
git checkout -b phase/4-ai

# Spawn sub-agent in a worktree on phase/5-deploy
git worktree add ../throughline-deploy -b phase/5-deploy
```

Then call the **Agent tool** with `subagent_type: general-purpose`, hand it:
- The kickoff prompt (slimmed to its phase)
- The exact branch name and worktree path
- Explicit "do not touch files outside `apps/host/`, `services/api/src/main/java/com/throughline/weeklycommit/infrastructure/notifications/`, `services/api/src/main/resources/db/migration/V_next__*`"
- "Commit + push your branch when done; do not open the PR — main agent reviews and opens"

When the sub-agent finishes, main agent reviews the worktree's diff, opens the PR.

---

## 3. Sub-agent spawn protocol

Three roles. Use only the ones described.

### `Explore` agent — read-only research within a phase

Use when entering a phase and the PRD section references files / patterns / libraries you haven't seen. Never spawn for code generation.

Spawn:
```
Agent({
  subagent_type: "Explore",
  description: "<3-5 word task>",
  prompt: "Concrete question. List the file paths to read. Tell me what you found in <200 words. No fluff."
})
```

Example: *"Read `docs/ai-copilot-spec.md` T3 system prompt and tell me what input fields the prompt assumes vs what the input shape provides. Flag any divergence."*

### `general-purpose` agent — parallel scaffolding

Use only for the two parallelism opportunities above. The agent works in a worktree on its own branch. Never spawn one to write a feature the main agent is also working on.

### Team agents

**Don't.** Too heavyweight for this build. The plan was already produced by a multi-agent team during planning; execution is single-agent.

---

## 4. Per-phase entry checklist

Run this checklist at the top of every phase. No exceptions.

```
[ ] git status clean; on the correct branch
[ ] read PRD section for this phase
[ ] read patches in docs/prd-patches.md tagged with this phase number
[ ] confirm prior phase's coverage gates were met (jacoco + vitest reports)
[ ] write the Gherkin .feature file(s) for this phase BEFORE any production code
[ ] write the backend contract test stubs (@WebMvcTest) BEFORE any controller
[ ] write the Vitest test names BEFORE any component
[ ] commit the test layer ("test(scope): phase N test layer")
[ ] now write production code, one logical unit per commit
[ ] run lint + type-check + tests locally before pushing
[ ] CI green before opening PR
```

If any item is skipped, write a new patch in `docs/prd-patches.md` documenting why.

---

## 5. Emergency triage

When something goes wrong, follow this ladder. Don't skip rungs.

### Rung 1 — Test failing >15 min

Stop. Read the test failure carefully. Did you change the contract or the implementation? If the contract changed, the test is correct and the impl is wrong. If the impl is correct, the test is wrong — but **never** delete or skip a test without a patch entry.

### Rung 2 — Test failing >30 min

Spawn an `Explore` agent: *"Test X at path Y is failing with error Z. Read the test file, the implementation file, and any related fixtures. Tell me the most likely root cause in <150 words."*

### Rung 3 — Phase blocked >45 min

Stop the phase. Open `docs/prd-patches.md` and write a new patch describing:
- What you tried
- What's blocking
- What you'll change in the PRD or scope to unblock

Apply the patch. Document. Move on. **Never** ship broken code with a TODO.

### Rung 4 — CI flaky

Don't `.skip` it. Don't `--no-verify` past it. Find the root cause. Common culprits:
- Race condition in a test fixture (await/timing)
- Test relies on order (`describe.serial` or similar)
- Auth0 / Anthropic API rate limit
- Postgres state leak between tests (truncate tables in `@BeforeEach`)

### Rung 5 — Demo failing during smoke

Phase 8 exit checks the demo path end-to-end. If the demo fails:
- Auth0 callback URLs configured for the Railway URL?
- `ANTHROPIC_API_KEY` env var set on Railway service?
- `SLACK_WEBHOOK_URL` set?
- CORS `ALLOWED_ORIGINS` includes both host and remote URLs?
- Seed data ran (check `app_user` row count = 175)?

Don't ship until all 5 are green.

---

## 6. What "done" looks like

The submission checklist from `docs/source-control-guide.md` is the final gate. Re-read it before sending AJ anything.

- Hosted URL live
- Repo public
- `main` tagged `v0.1.0`
- Demo recording captured
- AJ receives: URL, repo, `CLAUDE.md`

That's the whole orchestration. Build.
