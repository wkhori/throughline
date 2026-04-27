# Architecture Decisions

Lightweight requirement-to-implementation mapping. For every requirement in `project-brief.md`, this file states our decision and a one-line rationale. If a decision changes, update the row.

For the project methodology and the philosophy behind these decisions, see `CLAUDE.md`.

---

## The Rule

Every requirement in the brief gets exactly one of three treatments:

1. **Implement as specified.**
2. **Substitute** — implement the intent with a different mechanism, document why and the swap path.
3. **Out of scope** — drop, document why.

No silent skips. No silent expansions.

---

## Requirement Table

| # | Requirement | Decision | Mapping / Rationale |
|---|---|---|---|
| 1 | TypeScript strict mode | Implement | Used across all FE packages. |
| 2 | Java 21 | Implement | Backend runtime. |
| 3 | SQL | Implement | Postgres. |
| 4 | React 18 | Implement | FE framework. |
| 5 | Vite 5 + Module Federation | Implement | We build minimal host shell + weekly-commit remote ourselves (no access to PA/PM). |
| 6 | Spring Boot 3.3 | Implement | Backend framework. |
| 7 | Redux Toolkit + RTK Query | Implement | All API calls go through RTK Query with `tagTypes` invalidation. Lint rule blocks raw `fetch`/`axios`. |
| 8 | Flowbite React | Implement | Primary component library. Extended with Tailwind for Linear-grade polish where needed. |
| 9 | Tailwind CSS | Implement | Tailwind v4 canonical syntax. |
| 10 | Vitest | Implement | Unit tests for every component. |
| 11 | Playwright | **Out of scope** | Brief also requires Cypress + Cucumber/Gherkin (row 12). Two E2E frameworks for the same job dilutes coverage. Cypress is the more specific requirement; we commit to it. |
| 12 | Cypress + Cucumber/Gherkin BDD | Implement | `.feature` files treated as deliverable spec artifacts, not just tests. |
| 13 | ESLint 9 + Prettier 3.3 | Implement | FE lint/format gates. |
| 14 | Spotless + SpotBugs | Implement | BE lint/static-analysis gates. |
| 15 | JaCoCo ≥80% backend coverage | Implement | Enforced in CI. |
| 16 | All entities extend `AbstractAuditingEntity` | Implement | createdBy/createdDate/lastModifiedBy/lastModifiedDate on every entity. |
| 17 | PostgreSQL 16.4 | Implement | Primary data store. |
| 18 | Hibernate/JPA + Spring Data | Implement | ORM. |
| 19 | Flyway migrations | Implement | All schema changes versioned. |
| 20 | Auth0 OAuth2 JWT | Implement | Free Auth0 dev tenant. Seeded IC / Manager / Admin test users. JWT validation via Auth0 JWKS. |
| 21 | Yarn Workspaces + Nx monorepo | Implement | Host, remote, shared packages as workspace packages. |
| 22 | MF host/remote pattern (PM-style) | Implement (self-built host) | We build the host shell ourselves; the remote is built to drop into any compliant host. Same MF contract: shared singletons, JWT propagation, runtime `remoteEntry.js`. |
| 23 | Pagination (`Pageable`) up to 2000 records | Implement | All team-roll-up endpoints paginated. |
| 24 | API <200ms for plan retrieval | Implement | Indexed `(userId, weekStart)` lookups; N+1-free; benchmarked in CI. |
| 25 | Lazy-loaded routes for sub-second initial render | Implement | Route-level code splitting on the remote. |
| 26 | MF remote bundle optimized for CDN | Implement | Externalized shared deps; long-cache headers; content-hashed filenames. |
| 27 | Weekly commit CRUD + RCDO linking | Implement | Every commit FK-references a Supporting Outcome. |
| 28 | Chess layer (categorization + prioritization) | Implement | 2D matrix UI: category × priority, drag-and-drop placement. |
| 29 | Lifecycle state machine `DRAFT → LOCKED → RECONCILING → RECONCILED → Carry Forward` | Implement | Guarded transitions on backend; FE reflects state; carry-forward spawns next-week DRAFT with `parentCommitId`. |
| 30 | Reconciliation view (planned vs. actual) | Implement | Three-state per commit (done/partial/not done) + notes. |
| 31 | Manager dashboard with team roll-up | Implement | Pre-digested view; AI-generated insights; drill-down on flagged exceptions. |
| 32 | AWS (EKS / CloudFront / S3 / SQS / SNS) | **Substitute** → Railway + Terraform in `infra/` | Demo runs on Railway for fast, reliable delivery. Production-grade Terraform in `infra/` provisions the full AWS topology. Swap path: `terraform apply` + ECR push + Helm install. AWS topology detail in `ARCHITECTURE.md`. |
| 33 | Outlook Graph API integration | **Substitute** → Slack via `NotificationChannel` adapter | Adapter interface with `SlackChannel` (live), `OutlookGraphChannel` (stub), `LogChannel` (tests). Channel selected by config. Swap path: implement the stub, flip config. Adapter design detail in `ARCHITECTURE.md`. |
