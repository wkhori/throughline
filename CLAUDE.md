# CLAUDE.md — Weekly Commit Module

This file is the agent operating manual for this repository. Read it in full before doing any work. It is also a project deliverable — the hiring reviewer will read this file to understand how the project was built.

---

## 1. Project Methodology — Read This First

This project is a hiring work sample with a fixed problem statement and a long, partially-redundant tech-stack requirement list. The defining decision was made up front and applies to every choice downstream:

> **We optimize for solving the stated problem, not for checking every box on the tech-stack list.**
>
> Where a brief requirement clearly serves the problem statement, we implement it as specified. Where a requirement adds friction, redundancy, or distracts from the problem, we substitute it with a better-suited mechanism — and we **document the substitution explicitly** with the reasoning and a swap path back to the original.
>
> An opinionated, well-reasoned substitution lands stronger than thoughtless compliance. Coming into a technical conversation able to explain *"I dropped X because Y, here's the substitute, here's the swap path"* is the signal we are sending. Coming in able to say *"I implemented every line"* is not.

This is not a license to skip work. It is the opposite: every deviation is named, justified, and documented in `docs/architecture-decisions.md`. Nothing is silently dropped. Nothing is silently expanded.

### The Rule (applied in `docs/architecture-decisions.md`)

Every requirement from the project brief gets exactly one of three treatments:

1. **Implement as specified.** No deviation.
2. **Implement the intent with a substitute, document the substitution.** Purpose preserved, mechanism replaced. Documented with rationale and swap path.
3. **Out of scope, document why.** Stated reason. Stated condition under which it would be picked up.

If you (a future Claude instance, or a developer) are about to make a decision that deviates from the brief, **update `docs/architecture-decisions.md` first**, then implement. The doc is the source of truth for every architectural decision; if a decision is not in the doc, it has not been made.

### What the problem actually is

The brief mentions "manager" six times in a short document. The pain is **manager attention is the scarce resource.** ICs fill out 15Five forms; managers read everything and try to infer alignment manually. The loop is broken because the data model is unstructured and the manager bears all the cognitive load.

The reframe driving every feature decision in this repo:

> **The IC + AI copilot do the alignment work as a natural byproduct of planning. The manager's default view is a pre-digested strategic dashboard. They drill in only when the AI flags something worth their attention.**

Every feature is judged against: **does this reduce required manager attention without losing signal?** If not, it does not ship.

### Differentiation vs. 15Five

15Five markets itself as "AI-powered." It is not the differentiator we claim. Our differentiator is structural:

> **Our data model is a strategy-to-execution graph: every weekly commit is FK-linked to a Supporting Outcome in the RCDO tree. Our AI generates insights 15Five structurally cannot — e.g., "Outcome 3.2 received 47% of org effort this week, Outcome 3.1 received zero," or "this commit has been carry-forwarded four weeks running."**

Future agents working in this repo: protect this framing. Do not bolt on AI features that do not exploit the structured graph. AI that operates on unstructured text is what 15Five already does.

---

## 2. Required Reading (in order)

1. `project-brief.md` — the original brief from the hiring partner. Verbatim.
2. `docs/architecture-decisions.md` — every architectural decision, the requirement-treatment table, AWS production-target architecture, substitution rationales. **The single source of truth for decisions.**
3. `PRD.md` — the build script. Phase-by-phase plan with embedded test layer.
4. `docs/prd-patches.md` — 26 patches from the gap audit. 10 critical applied inline, 12 important per-phase, 4 minor queued. Read patches tagged with the phase you're entering.
5. `docs/ai-copilot-spec.md` — full prompt text + JSON schemas + fallbacks for T1–T7.
6. `docs/source-control-guide.md` — branching model (5 branches total), commit cadence, PR workflow.
7. `docs/orchestration-plan.md` — the working contract for execution: kickoff prompt, order of operations, sub-agent spawn protocol, per-phase entry checklist, emergency triage ladder.
8. `ARCHITECTURE.md` — domain model (RCDO graph, lifecycle state machine), MF host/remote contract, AI copilot data flow, notification adapter design. *(Created during build.)*
9. `README.md` — what it is, demo URL, how to run. *(Created during build.)*

If the brief, this file, and `docs/architecture-decisions.md` ever conflict, `docs/architecture-decisions.md` wins for *applied* decisions. The brief wins for *unstated* decisions (default to it).

---

## 3. How to Work in This Repo

### Before making any architectural decision

1. Read `docs/architecture-decisions.md` to see if the decision has already been made.
2. If it has, follow it.
3. If it has not, decide using the Rule (§1), update `docs/architecture-decisions.md` with the new decision, then implement.

### Before deviating from the brief

1. Confirm the deviation serves the problem statement, not personal preference.
2. Add a row to the requirement-treatment table in `docs/architecture-decisions.md` (or move an existing row's tier).
3. Write the rationale and the swap path back to the original.
4. Then implement.

### Coding conventions

- **Frontend:** TypeScript strict mode. ESLint 9 + Prettier 3.3 must pass. Tailwind v4 canonical syntax (`bg-(--color-name)` not `bg-[var(--color-name)]`, `bg-linear-to-r` not `bg-gradient-to-r`, scale-divided spacing, no arbitrary `[600px]` values where a scale value exists). Run `npx prettier --write <file>` after writing/editing files with Tailwind classes.
- **Component library:** Flowbite React. Extend with Tailwind for Linear-grade polish. Do not introduce alternative component libraries.
- **State / data:** All server interactions go through RTK Query endpoints with `tagTypes` for invalidation. **No raw `fetch`, no `axios`, no manual thunks for data fetching in app code.** A lint rule enforces this.
- **Backend:** Java 21. Spring Boot 3.3. All entities extend `AbstractAuditingEntity`. Spotless + SpotBugs must pass. JaCoCo coverage ≥ 80%. Flyway for every schema change — no manual SQL.
- **Tests:** Vitest unit tests for every component. Cypress + Cucumber/Gherkin `.feature` files for E2E acceptance scenarios, treated as deliverable spec artifacts. Playwright is out of scope (see `docs/architecture-decisions.md` row 11). **AI evals use `@wkhori/evalkit`** (the user's published deterministic eval framework). LLM-as-judge layer is a v2 add — deterministic assertions are sufficient for v1.
- **Commits:** Never include `Co-Authored-By` lines. Never include "Generated with Claude Code" in PR descriptions. Conventional-commit prefixes: `feat | fix | test | docs | refactor | chore | perf` with scope. Full conventions in `docs/source-control-guide.md`.
- **Branching:** 5 branches total (`phase/1-foundation` through `phase/5-deploy`), one PR each. Trunk-based. Squash-merge. See `docs/source-control-guide.md`.

### When in doubt, optimize for…

In this order:

1. **Does this serve the manager-burden-reduction reframe?** If not, justify or cut.
2. **Does this exploit the structured RCDO graph for AI insight that 15Five cannot produce?** If we are adding AI, this question gates it.
3. **Is the deviation from the brief documented in `docs/architecture-decisions.md`?** If not, document before implementing.
4. **Is the visual quality at the Linear bar?** Restrained, calm, content-forward. Density without clutter.
5. **Will a reviewer reading the repo understand *why* in under five minutes?** The README and this file plus `docs/architecture-decisions.md` are how we earn that.

---

## 4. The Lifecycle (canonical reference)

`DRAFT → LOCKED → RECONCILING → RECONCILED → CARRIED_FORWARD`

- **DRAFT** — IC writes commits, links each to a Supporting Outcome, places each on the chess layer (2D categorization × priority matrix). AI copilot suggests Outcomes and flags drift.
- **LOCKED** — IC locks the week. No further plan edits. AI copilot generates a portfolio review (over/under-investment by Outcome).
- **RECONCILING** — End of week. IC marks each commit done / partial / not done with notes.
- **RECONCILED** — Reconciliation submitted. AI copilot generates the alignment delta. Manager digest fires.
- **CARRIED_FORWARD** — Terminal state on the original commit; spawns a new DRAFT in week N+1 with `parentCommitId` reference. Enables "carry-forwarded N weeks running" insights.

---

## 5. AI Copilot Surface (canonical reference)

The AI Strategic Alignment Copilot operates across the lifecycle, not as a single screen. **Seven touchpoints (T1–T7).** Full prompt text + schemas + fallbacks in `docs/ai-copilot-spec.md`.

- **DRAFT:** T1 Outcome suggestion (Haiku) + T2 Drift warning (Haiku) + T7 Commit Quality lint (Haiku).
- **LOCKED:** T3 Portfolio review (Sonnet) — flag over/under-investment by Outcome / DO / Rally Cry.
- **RECONCILED:** T4 Alignment delta (Sonnet) — shipped, slipped (with cause), carry-forward recommendations.
- **MANAGER:** T5 weekly digest (Sonnet) delivered via notification channel adapter (Slack live, Outlook Graph stub) + T6 alignment-risk alert (Haiku, hourly background scan).

Provider: Anthropic. Haiku for high-volume cheap tasks. Sonnet for analytical work. Per-org token budget enforced server-side in `AnthropicClient.preflight()` (`PESSIMISTIC_READ` on `AIBudget`).

---

## 6. Deliverables to the Hiring Partner

1. **Hosted app URL.** Railway deployment.
2. **Repo URL.**
3. **This file.** `CLAUDE.md`.

The reviewer will check, in roughly this order: this file, `docs/architecture-decisions.md`, `README.md`, the live app, the test suites, the Terraform in `infra/`. Every one of those is a first-class artifact.
