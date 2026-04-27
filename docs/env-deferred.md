# Deferred Environment Variables

Per `docs/orchestration-plan.md` Continue-and-Defer rule, this file lists every
external credential the build is currently substituting with a stub. Each row
is removed in a `chore(env): wire real <VAR>` commit when the user posts
`<VAR> now in .env.local`.

| Var | Stub provider | Smoke that flips on real value |
|-----|---------------|--------------------------------|
| _(none — all credentials provisioned)_ | — | — |

## Resolved (status snapshot — keep here for audit, not as gates)

| Var | Resolved on | Real provider now active |
|-----|-------------|--------------------------|
| `AUTH0_ISSUER_URI` / `AUTH0_AUDIENCE` / `VITE_AUTH0_*` | `phase/4-ai` entry | Real Auth0 JWKS-backed `JwtDecoder`; tenant `thoughline.us.auth0.com`; SPA app + API + post-login Action + 3 demo users provisioned via `scripts/auth0-provision.mjs` (P37). |
| `ANTHROPIC_API_KEY` | `phase/4-ai` entry | Real `AnthropicClient` (`@ConditionalOnProperty(name="anthropic.api-key")`); `StubAnthropicClient` becomes the test-time fallback only. |
| `SLACK_WEBHOOK_URL` (with `NOTIFICATION_CHANNEL=slack`) | `phase/4-ai` entry | `SlackChannel` posts Block Kit to the configured webhook; `LogChannel` becomes the test-time fallback only. |

## Rules

1. The agent never blocks waiting on a credential.
2. Every stub-backed test is tagged `@stub`. Every real-integration twin is
   tagged `@integration` and runs unconditionally now that the credentials
   are present (no auto-skip).
3. When a credential changes (rotation, tenant move), update both `.env.local`
   and the snapshot table above with the new resolved date.
