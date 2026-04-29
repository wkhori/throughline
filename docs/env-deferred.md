# Environment Credential Status

> **Status as of `v0.1.0` (Phase 8 deploy): all credentials resolved. Live demo on Railway.**

This file tracks stub/real status under the Continue-and-Defer rule. Every
external credential is now in `.env.local` (gitignored) and on the matching
Railway service, and the corresponding real provider is the runtime default.
The file is retained as an audit log + onboarding reference, not as a gate.

## Active deferrals

_None._

## Resolved credentials (snapshot)

| Var | Resolved on | Real provider now active |
|-----|-------------|--------------------------|
| `AUTH0_ISSUER_URI` / `AUTH0_AUDIENCE` / `VITE_AUTH0_*` | between `phase/3-manager` and `phase/4-ai` | Real Auth0 JWKS-backed `JwtDecoder`; tenant `thoughline.us.auth0.com`; SPA app + API + post-login Action + 3 demo users provisioned via `scripts/auth0-provision.mjs` (P37). |
| `ANTHROPIC_API_KEY` | between `phase/3-manager` and `phase/4-ai` | Real `AnthropicClient` (`@ConditionalOnProperty(name="anthropic.api-key")`) ships in `phase/4-ai`. `StubAnthropicClient` becomes the test-time fallback only. |
| `SLACK_WEBHOOK_URL` (with `NOTIFICATION_CHANNEL=slack`) | between `phase/3-manager` and `phase/4-ai` | `SlackChannel` posts Block Kit to the configured private channel; `LogChannel` becomes the test-time fallback only. Webhook scoped to a single private channel at install time (Slack enforces channel binding at the webhook URL level). |
| Railway services (`api`, `host`, `weekly-commit-remote`, `Postgres`) | `phase/5-deploy` | Live URLs in `README.md`. Each service holds its own copy of the relevant `.env.local` keys via `railway variable set`. Auth0 SPA app patched with the Railway host origin via `AUTH0_EXTRA_ORIGINS=… node scripts/auth0-provision.mjs`. Auth0 RBAC enabled on the API resource-server (`enforce_policies=true`, `token_dialect=access_token_authz`); IC/MANAGER/ADMIN permissions assigned to the demo users so password-realm tokens carry the `permissions` claim. |

## Test discipline

1. Every external surface ships **two** test variants:
   - `@stub` — runs offline against the deterministic stub (CI default; no network).
   - `@integration` — runs against the real provider; now executable unconditionally because the credentials are present.
2. New `@integration` scenarios authored in `phase/4-ai`+ should run on every PR merge, not gated.
3. Eval harness E1–E7 runs against the real Anthropic API at N=3 with a ≥2/3 pass threshold (residual non-determinism absorber).

## How to rotate / replace a credential

1. Update the value in `.env.local`.
2. Restart the affected service (`docker compose down && docker compose up -d` for Postgres, redeploy for Railway services later).
3. Re-run the integration suite for that surface — `./gradlew test --tests "*Integration*"` or `yarn nx test <project> --grep @integration`.
4. Update the snapshot row above with the new resolved date if the rotation involved a tenant change (not strictly needed for key rotation).
