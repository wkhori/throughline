# Deferred Environment Variables

Per `docs/orchestration-plan.md` Continue-and-Defer rule, this file lists every
external credential the build is currently substituting with a stub. Each row
is removed in a `chore(env): wire real <VAR>` commit when the user posts
`<VAR> now in .env.local`.

| Var | Stub provider | Smoke that flips on real value |
|-----|---------------|--------------------------------|
| `AUTH0_ISSUER_URI` / `AUTH0_AUDIENCE` / `VITE_AUTH0_*` | `MockJwtDecoder` (backend, dev profile) + `MockAuth0Provider` (host) | `auth/login.feature @integration` + `/me` 200 |
| `ANTHROPIC_API_KEY` | `StubAnthropicClient` (deterministic fixtures keyed by prompt name + input hash) | `evals/runner.ts` E1–E7 at N=3 ≥2/3 + AI feature `@integration` scenarios |
| `SLACK_WEBHOOK_URL` (with `NOTIFICATION_CHANNEL=slack`) | `LogChannel` (SLF4J INFO sink) | `notifications/slack-digest.feature @integration` + `/notifications/digest/run` smoke |

## Rules

1. The agent never blocks waiting on a credential.
2. Every stub-backed test is tagged `@stub`. Every real-integration twin is
   tagged `@integration` and auto-skipped while the credential is unset.
3. When the user posts `<VAR> now in .env.local`, run `@integration` for that
   surface, the eval harness if applicable, and one manual curl/gh smoke; log
   the results in the relevant PR body or a follow-up commit.
