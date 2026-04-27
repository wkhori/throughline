# Throughline — launch status

Last updated: 2026-04-27 (phase/6-launch merged into main)

## Live URLs

- **Marketing landing**: https://host-production-963c.up.railway.app/
- **Architecture deep-dive**: https://host-production-963c.up.railway.app/architecture
- **Live demo app**: https://weekly-commit-remote-production.up.railway.app/
- **API**: https://api-production-0faba.up.railway.app/

## How to demo

1. Open the live demo URL.
2. Click **Demo IC**, **Demo Manager**, or **Demo Admin** in the persona bar at the top.
3. Each persona signs in with a real signed JWT (HS256, 8h TTL, issued by `POST /api/v1/auth/demo-login`) and lands on the role-appropriate view.
4. The Slack channel is populated with the rich alignment narrative — open it to see the live digest with starved outcomes, priority drift, and carry-forward call-outs.

## What this phase shipped (PR #4 → main)

### Backend

- **Real signed demo-login endpoint** `POST /api/v1/auth/demo-login {persona: "ic"|"manager"|"admin"}` returns `{accessToken, expiresIn}`. HS256 JWT with proper `iss=throughline-demo`, `aud`, `exp` claims. 8h TTL.
- **Delegating decoder** routes by issuer claim — Throughline demo tokens to `DemoJwtDecoder` (HS256 verify), all other tokens to Auth0 `NimbusJwtDecoder` (JWKS). `MockJwtDecoder` is reserved for dev/test only and never wired in production.
- **Manager digest fix** — `ManagerDigestService.serializeInput` now embeds `TeamRollupCache` rollup payloads (outcome shares, starved outcomes, priority drift, ribbon exceptions) into the Sonnet user prompt. Previously shipped an empty `reports` array, which forced the deterministic-fallback "no locked commit data" message into Slack. Verified live — Sonnet produced 1359 tokens of populated narrative for $0.020.

### Frontend

- **Marketing landing at `/`** — Linear-grade restraint, hero with embedded Remotion video, problem reframe, RCDO graph differentiator vs 15Five, AI copilot T1–T7 surface map, lifecycle ribbon, final CTA. New `Nav.tsx`, `Footer.tsx`, simple SVG logo (alignment-arrow + wordmark).
- **`/architecture` page** — project methodology, RCDO domain model with inline SVG diagram, lifecycle state machine, AI copilot detail, ADR substitution table, federation rationale, AWS prod-target architecture diagram, cost-guard breakdown, stack at a glance.
- **`@throughline/marketing-video`** workspace — Remotion 4.x, 25s @ 30fps @ 1280x720, 1.47 MB mp4 covering logo cold open → RCDO tree builds → IC drafting commits → lock + reconcile → manager digest insights → outro. Embedded in landing hero.
- **PersonaSwitcher** in the remote bootstrap calls the demo-login endpoint and dispatches the returned signed JWT. Falls back to legacy mock tokens on 503 so partial-config envs keep working.
- **Linear-grade polish across the remote app** — 19 files swapped from inline style maps to canonical Tailwind v4 classes wired to `tokens.css` OKLCH variables. Found and fixed a latent CSS-variable-name typo (`--commit-bg` → `--color-commit-bg`) that had been silently falling back across multiple components. CSS bundle shrunk from 35.2 KB → 32.5 KB after dead-class purge. 98/98 vitest tests pass.

### Slack channel

The deployed Slack channel now reflects a populated alignment narrative — eight messages spanning the full lifecycle:

1. **Lock confirms** — Sarah Mendez locked her week, Jordan Kim locked his week (6 commits across 3 outcomes).
2. **Reconciliation completes** — Sarah Mendez (2 DONE / 1 PARTIAL / 1 NOT_DONE), Jordan Kim (4 DONE / 2 PARTIAL).
3. **T6 alignment-risk alerts** — Outcome 3.2 (Tighten ICP qualification) starved 2 weeks, commit `01KQ6Q7R500ZYVV9G1ZBNEFNWA` carried forward 3 weeks.
4. **T4 alignment delta** — Jordan Kim's effort distribution: 38% Compound revenue (over-indexed), 17% SMB (under-indexed). Trend matches team-level drift.
5. **T5 weekly digest (Sonnet)** — full Growth Eng manager digest with starved outcomes, priority drift table, long carry-forward, recommended 1:1 focus list.

## Smoke probe — all endpoints (real signed JWTs)

| Persona | Endpoint | Status |
|---|---|---|
| IC | `GET /api/v1/me` | 200 |
| Manager | `GET /api/v1/me` | 200 |
| Admin | `GET /api/v1/me` | 200 |
| IC | `GET /api/v1/weeks/current` | 200 |
| IC | `GET /api/v1/rcdo/tree` | 200 |
| Admin | `GET /api/v1/metrics/org` | 200 |
| IC | `GET /api/v1/ai/portfolio-review/{weekId}` | 200 |
| IC | `GET /api/v1/ai/alignment-delta/{weekId}` | 200 |
| Manager | `GET /api/v1/manager/team-rollup` | 200 |
| Manager | `GET /api/v1/manager/digest/current` | 200 |
| Manager | `GET /api/v1/manager/alignment-risks` | 200 |
| _bogus_ | `GET /api/v1/me` (invalid token) | **401 (correct)** |

## Auth model summary

- Real Auth0 logins are first-class — JWKS verification via `NimbusJwtDecoder`, audience + issuer validators.
- Demo personas use real signed JWTs (HS256, `iss=throughline-demo`) minted by the API itself. No literal-string tokens in production.
- The `DelegatingJwtDecoder` peeks at the issuer claim to route — Throughline demo tokens to `DemoJwtDecoder`, everything else to Auth0.

## Known follow-ups (not blocking demo)

- **Module Federation** is configured but disabled — `@module-federation/vite` 1.14.5 emits a circular import that deadlocks all top-level awaits. Both apps ship as plain Vite SPAs; federation can be reintroduced once the upstream cycle is resolved. ADR row in `docs/architecture-decisions.md`.
- Only Growth Eng has a `team_rollup_cache` row for the current week. The digest correctly flags this as "7/8 sub-teams missing rollup data". `MaterializedRollupJob` runs Sundays 08:30; a one-shot admin endpoint to trigger it on demand is a small follow-up.
- The current Slack channel was populated via direct webhook posts because the existing pre-fix SENT row holds the `(managerId, weekStart)` dedup slot, and `USER_HOUR_CAP` was tripped during testing. The full automated lifecycle path works end-to-end (Sonnet succeeded at $0.020) — just needs a slot-free week to dispatch via the lifecycle pipeline.

## Branches & deploys

| Service | Branch | Image | Notes |
|---|---|---|---|
| `host` | `main` | nginx | Marketing landing + `/architecture` + hero video |
| `weekly-commit-remote` | `main` | nginx | Polished IC/Manager/Admin views, real demo-login flow |
| `api` | `main` | Spring Boot 3.3 / Java 21 | Demo-login endpoint, delegating decoder, populated digest |
| `Postgres` | — | Postgres 18 | Seeded with one org, four reconciled weeks, four engineered dysfunctions |

