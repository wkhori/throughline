# Environment Credential Status

> **Status as of `phase/4-ai` entry: all credentials resolved. No active deferrals.**

This file used to track stub/real status under the orchestration-plan
Continue-and-Defer rule. Every external credential is now in `.env.local`
(gitignored), and the corresponding real provider is the runtime default.
The file is retained as an audit log + onboarding reference, not as a gate.

## Active deferrals

_None._

## Resolved credentials (snapshot)

| Var | Resolved on | Real provider now active |
|-----|-------------|--------------------------|
| `AUTH0_ISSUER_URI` / `AUTH0_AUDIENCE` / `VITE_AUTH0_*` | between `phase/3-manager` and `phase/4-ai` | Real Auth0 JWKS-backed `JwtDecoder`; tenant `thoughline.us.auth0.com`; SPA app + API + post-login Action + 3 demo users provisioned via `scripts/auth0-provision.mjs` (P37). |
| `ANTHROPIC_API_KEY` | between `phase/3-manager` and `phase/4-ai` | Real `AnthropicClient` (`@ConditionalOnProperty(name="anthropic.api-key")`) ships in `phase/4-ai`. `StubAnthropicClient` becomes the test-time fallback only. |
| `SLACK_WEBHOOK_URL` (with `NOTIFICATION_CHANNEL=slack`) | between `phase/3-manager` and `phase/4-ai` | `SlackChannel` posts Block Kit to the configured private channel; `LogChannel` becomes the test-time fallback only. Webhook scoped to a single private channel at install time (Slack enforces channel binding at the webhook URL level). |

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
