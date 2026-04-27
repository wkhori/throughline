# Source Control Guide

This document is the contract for git workflow on this repo. Read once, follow always. Cross-referenced from `CLAUDE.md`.

---

## Branching model — 5 branches total

The PRD's 9 phases map to **5 branches and 5 PRs**, not one-per-phase. Phase clusters were chosen so each branch is a meaningful, demoable unit and PR overhead stays low.

| Branch | Phases | What lands |
|---|---|---|
| `phase/1-foundation` | 0 + 1 | Repo bootstrap, Auth0 + Spring Security, V1/V2 migrations, RCDO admin authoring, MF singleton smoke test, Phase-1 seed |
| `phase/2-lifecycle` | 2 + 3 | Week + Commit domain, DRAFT→LOCKED state machine, reconciliation, carry-forward lineage, V3 migration |
| `phase/3-manager` | 4 | Manager dashboard, materialized rollup, 2000-row perf gate, manager scope auth |
| `phase/4-ai` | 5a + 5b + 5c | AnthropicClient + cost guards + cache, all 7 touchpoints (T1–T7), websocket fallback, alert dedupe, ack endpoint, V4 migration |
| `phase/5-deploy` | 6 + 7 + 8 | Notifications + Slack + scheduled jobs, metrics endpoint, Linear-grade UI polish, Railway deploy, Terraform plan-clean, Slack health check |

5 branches, 5 PRs. Each PR demonstrates one full SDD+TDD cycle (tests written first, implementation, CI green). Reviewer reading git history sees coherent feature blocks.

---

## Commit cadence

**One commit per logical unit.** Examples of a "unit":

- One Flyway migration + the entity classes it backs.
- One controller endpoint + its `@WebMvcTest`.
- One React component + its Vitest file.
- One Gherkin feature file + its step definitions stub (separate commit when impl lands).
- One bug fix.
- One refactor that doesn't change behavior.

**Don't:**
- Don't commit per file. Noise.
- Don't squash a whole phase into one giant commit. Reviewers read history.
- Don't `--amend` a pushed commit.
- Don't `--no-verify` to skip hooks. If a hook fails, fix the underlying issue.

**Conventional commits.** Use these prefixes — they map cleanly to the 9-phase PRD:

```
feat(scope):    new feature or new file that ships product surface
fix(scope):     bug fix
test(scope):    test added or updated; no production code change
docs(scope):    documentation
refactor(scope):code change that doesn't add features or fix bugs
chore(scope):   build, deps, tooling
perf(scope):    performance improvement
```

Scopes (one of): `host`, `remote`, `api`, `ai`, `notif`, `infra`, `db`, `auth`, `manager`, `lifecycle`, `seed`, `evals`, `ui`.

Examples:
- `feat(lifecycle): week state machine with guarded transitions`
- `test(ai): T3 portfolio review eval scenario E3`
- `feat(infra): terraform module for static-bundle CloudFront+S3`
- `fix(auth): audience validator rejects mismatched aud claim`

---

## PR workflow

### Opening a PR

1. Branch is up-to-date with `main` (rebase, don't merge).
2. CI green (lint, type-check, all tests, coverage gates).
3. PR title matches the branch — e.g. `Phase 1: Foundation (auth + RCDO + seed)`.
4. PR body uses this template:

```markdown
## What lands
- [ ] Phase N tests written first (Gherkin + contract stubs + Vitest list)
- [ ] Implementation complete
- [ ] CI green: lint, type-check, Vitest ≥80%, JaCoCo ≥80%, Cypress @phase-N pass

## Patches applied (from docs/prd-patches.md)
- [ ] PX — <one-line>
- [ ] PY — <one-line>

## Screenshots / Loom
<one screenshot per major UI surface, or one Loom for the full flow>

## Out-of-scope (by design)
- <anything from the deferred list this PR explicitly does NOT do>
```

5. Self-merge after CI green. No external reviewer required for the work-sample build; the PR template + history is the artifact.

### Merging

- **Squash-merge.** Keeps `main` linear and readable. The PR title becomes the squash-commit subject; the PR body becomes the body.
- After merge: delete the remote branch immediately. Don't accumulate stale branches.

### Conflicts

- Always `git fetch origin && git rebase origin/main` before opening a PR. Never `git merge main` into a feature branch — pollutes history.
- Migration conflicts: if Phase X added `V3__commits.sql` and Phase Y also wants `V3__*`, Phase Y renames to `V4__*` *before* opening its PR. The first PR to merge wins the version number.

---

## Worktrees (parallelism)

Phases are mostly linear (each depends on the prior). The PRD has **two genuine parallelism opportunities** worth using only if the main agent is blocked on one:

| Parallel pair | Why they can run in parallel |
|---|---|
| `phase/4-ai` (5a — Anthropic infra + T1/T2/T7) and `phase/5-deploy` (6 — notifications) | Notifications uses event-driven dispatch (no AI dependency yet); AI Phase 5a doesn't need notifications. They share zero files. |
| `phase/4-ai` (5c — T5/T6 + cron) and `phase/5-deploy` (6 — notifications channel adapter) | T5 *uses* the notification channel; the channel implementation can be built in parallel and integrated at the end of 5c. |

**Do not parallelize anything else.** Phase 1→2→3→4→5 sequence is the safe path.

### Worktree commands

If parallelizing:

```bash
# Create a worktree for the parallel branch
git worktree add ../throughline-deploy phase/5-deploy

# Spawn a sub-agent in that worktree (see orchestration-plan.md)
# When done:
cd ../throughline-deploy
# ... finish work, commit, push
git push -u origin phase/5-deploy

# Back in main worktree:
cd ../throughline
git worktree remove ../throughline-deploy
```

**Rule:** worktrees only for the two pairs above. Not for "let me try X in another branch" — that's what local stash + branch is for.

---

## Branch hygiene

- Long-lived: only `main`.
- Feature branches live until their PR merges, then are deleted.
- No `develop`, no `release/*`, no `hotfix/*`. Trunk-based, period.
- Tags: tag `main` after the final phase merges with `v0.1.0` for the demo submission.

---

## Things that are forbidden

- `git push --force` to `main`. Ever.
- `git commit --no-verify` unless the user explicitly authorizes it for one specific commit.
- Direct commits to `main`. Always go through a branch + PR.
- Adding `Co-Authored-By: Claude` lines to commits (per global CLAUDE.md rule).
- "🤖 Generated with Claude Code" footers in PR descriptions.

---

## Submission checklist (after `phase/5-deploy` merges)

1. Tag `main` as `v0.1.0`.
2. Verify hosted URL is live and demonstrable.
3. Verify repo is public.
4. Generate a fresh demo recording (Loom or QuickTime) of the full flow.
5. Send AJ:
   - Hosted URL
   - Repo URL
   - `CLAUDE.md` (verbatim copy)
6. Done.
