# Module Federation Runtime Re-enable Plan

Investigation date: 2026-05-01

## Goal

Re-enable the required Vite Module Federation runtime between:

- Host: `apps/host`, served from `host-production-963c.up.railway.app`
- Remote: `apps/weekly-commit-remote`, served from `weekly-commit-remote-production.up.railway.app`

The host `/app` route must dynamically load the weekly-commit remote through `@module-federation/vite`. Both apps must still run standalone through `yarn dev:host`, `yarn dev:remote`, and the standalone Railway remote deploy.

## Executive Summary

The failed attempt was not primarily an nginx, CORS, Railway env, React wrapper, or `build.target` problem. The blocking issue is the runtime shape emitted by `@module-federation/vite@1.14.5`.

Version `1.14.5` emits shared dependency proxy chunks that perform top-level `await` against federation initialization. In this repo, the shared workspace packages are also shared singleton providers, and those providers import React, Redux, RTK, and shared-ui code through the same generated proxy layer. That produces an async bootstrap cycle: chunks load successfully, federation instances register, but the app entry waits on generated `__loadShare__` modules that never finish, so React never mounts.

The practical fix is to re-enable federation on `@module-federation/vite@1.15.1` or newer after verifying the current latest version at implementation time. `1.15.1` changes the generated bootstrap from top-level-await share proxies to a pre-initialized module cache (`__mf_module_cache__`) and emits an `mf-entry-bootstrap-0.js` startup wrapper that initializes federation before importing the app entry.

## Evidence

I reproduced the reverted commit range in a temporary worktree at `71dc419` and inspected generated artifacts.

With `@module-federation/vite@1.14.5`:

- `yarn nx build host --skip-nx-cache` succeeded.
- `yarn nx build weekly-commit-remote --skip-nx-cache` succeeded but took roughly 15 minutes and logged a `TYPE-001` DTS generation error.
- The built host and remote entries contained generated `__mfe_internal__*__loadShare__*` chunks.
- The `loadShare` chunks contained top-level `await` against `initPromise`.
- The standalone remote HTML loaded two independent module scripts: injected `hostInit-*.js` and the app entry. The app entry statically imported generated share proxies before React could mount.

With `@module-federation/vite@1.15.1` in the same temporary worktree:

- The remote build completed in roughly 13 seconds.
- The remote build emitted `mf-entry-bootstrap-0.js`, a small `remoteEntry.js`, `hostInit-*.js`, and generated `.mjs` share chunks.
- The bootstrap script calls `initHost()`, warms shared modules into `globalThis.__mf_module_cache__.share`, then imports the app entry.
- The host build completed after removing raw documentation text that literally contained the federated dynamic import expression.
- The host bootstrap preloads `runtime.loadRemote("weekly_commit_remote/App")` before importing the host app entry.

This matches the upstream changes in `@module-federation/vite`:

- Official Vite plugin docs show this plugin is intended to consume remotes, expose modules, configure shared dependencies, set `server.origin`, and target at least `chrome89`: https://module-federation.io/guide/build-plugins/plugins-vite.html
- PR #665, merged 2026-04-29, explicitly fixes host-only shared module cache seeding: https://github.com/module-federation/vite/pull/665
- PR #667, merged 2026-04-29, fixes shared dependency Vite optimization interop: https://github.com/module-federation/vite/pull/667
- PR #666, merged 2026-04-29, fixes shared subpath imports: https://github.com/module-federation/vite/pull/666
- `npm view @module-federation/vite version` returned `1.15.1` during this investigation.

## Root Cause

The root cause is the `1.14.5` generated share-loading model.

Throughline shares these singleton packages across host and remote:

- `react`
- `react-dom`
- `react-router-dom`
- `@reduxjs/toolkit`
- `react-redux`
- `@auth0/auth0-react`
- `@throughline/shared-ui`
- `@throughline/shared-types`

The workspace path aliases point `@throughline/shared-ui` and `@throughline/shared-types` directly at source files. `@throughline/shared-ui` itself imports React and Redux APIs. Under `1.14.5`, the plugin rewrites these imports through generated `__loadShare__` proxy chunks. Those chunks wait at top level for federation init. The app entry also waits for those same chunks before it can call `createRoot().render(...)`.

That explains the observed state:

- `remoteEntry.js` and all generated chunks load with HTTP 200.
- `globalThis.__FEDERATION__.__INSTANCES__` contains both host and remote instances.
- The host instance has the correct remote entry URL.
- React still does not mount because the unresolved promise is inside the generated module evaluation path, not in the network layer.

The `chrome89` target change was insufficient because it only changes syntax support for top-level await. It does not remove the async cycle.

## Not Root Causes

- CORS: remote nginx already sends permissive CORS headers for `remoteEntry.js` and static assets. Network loads were 200.
- Railway build args: the last reverted commit fixed the host env var name to `VITE_WEEKLY_COMMIT_REMOTE_URL`.
- Remote wrapper: exposing a `federated-entry.tsx` that owns its own Redux provider is compatible with the requirement and preserves standalone mode.
- `target: esnext` vs `target: chrome89`: both retain the same 1.14.5 runtime shape.
- Docker/nginx static serving: important for production validation, but not the source of the local all-200/no-mount failure.

## Required Implementation

### 1. Upgrade the Vite Federation Plugin

Upgrade both app packages from `@module-federation/vite@1.14.5` to an exact `1.15.1` pin.

Do not use a caret range for the initial fix. If implementation happens after 2026-05-01, first re-check `npm view @module-federation/vite version` and review the diff from `1.15.1` before choosing a newer exact pin.

Files:

- `apps/host/package.json`
- `apps/weekly-commit-remote/package.json`
- `yarn.lock`

### 2. Reintroduce Federation Config

Re-enable `federation()` in both Vite configs.

Host config requirements:

- `name: "host"`
- Remote alias: `weekly_commit_remote`
- Remote entry: `process.env.VITE_WEEKLY_COMMIT_REMOTE_URL` with local fallback `http://127.0.0.1:5174/remoteEntry.js`
- Remote config type: `module`
- Shared singletons sourced from `packages/shared-deps-versions.json`
- `dts: false` for the initial implementation
- `server.origin: "http://127.0.0.1:5173"`
- Build target: `chrome89`

Remote config requirements:

- `name: "weekly_commit_remote"`
- `filename: "remoteEntry.js"`
- Expose `./App` from `./src/federated-entry.tsx`
- Shared singletons sourced from `packages/shared-deps-versions.json`
- `dts: false` for the initial implementation
- `server.origin: "http://127.0.0.1:5174"`
- `server.cors: true`
- Build target: `chrome89`

Recommendation: remove the current `cssCodeSplit: false` override when federation is enabled. Let the plugin manage the chunk graph. If the host-loaded remote misses CSS in smoke tests, use the plugin's `bundleAllCSS: true` on the remote rather than globally disabling CSS splitting.

### 3. Preserve Standalone and Federated Remote Entrypoints

Restore a federated entry for host consumption, but keep `bootstrap.tsx` as the standalone app entry.

Remote standalone path:

- `apps/weekly-commit-remote/src/bootstrap.tsx`
- Owns `createRoot`, `Provider`, `ApiBaseUrlProvider`, `PersonaSwitcher`, and `WeeklyCommitApp`
- Must continue to work at the remote Railway URL

Remote federated path:

- `apps/weekly-commit-remote/src/federated-entry.tsx`
- Exports the weekly-commit app as a React component
- Owns its own `Provider`, `ApiBaseUrlProvider`, `PersonaSwitcher`, and store
- Imports `@throughline/shared-ui/styles/tokens.css`

This intentionally keeps the host ignorant of the remote's RTK Query store. That differs from the original PRD's host-owned auth-store ideal, but it satisfies the current project goal: the host dynamically imports the remote at `/app` while the remote remains independently deployable.

### 4. Restore Host Runtime Import

Host route behavior:

- `apps/host/src/App.tsx` must mount `RemoteBoundary` at `/app`
- Remove the `window.location.href` redirect from `/app`
- `apps/host/src/components/RemoteBoundary.tsx` must lazy-load `weekly_commit_remote/App`
- Restore a TypeScript declaration for the federated module in `apps/host/src/types/federated-modules.d.ts`

### 5. Avoid the 1.15.1 Transform Text Trap

`@module-federation/vite@1.15.1` currently rewrites literal text that looks like a dynamic import of a configured remote. In the temporary validation, this source text inside `Architecture.tsx` broke the host build:

- text containing the exact remote specifier inside `import(...)`
- JSX code-label text containing the same expression

Before enabling `1.15.1`, remove or rephrase any docs/UI strings containing the exact dynamic import expression for `weekly_commit_remote/App`.

Suggested source check before build:

- Search for the remote specifier outside `RemoteBoundary.tsx` and the `.d.ts` declaration.
- Documentation can say "RemoteBoundary dynamic import" instead of showing the literal expression.

This is not the original runtime bug, but it is a real implementation blocker for the upgrade.

### 6. Fix nginx Caching for the New Bootstrap File

`@module-federation/vite@1.15.1` emits a root-level startup file named like `mf-entry-bootstrap-0.js`.

Current host and remote nginx configs long-cache every `.js` file as immutable. That would incorrectly cache `mf-entry-bootstrap-0.js`, because it is not content-hashed and `index.html` will keep referencing the same filename across deploys.

Add a no-cache rule before the immutable asset rule in both nginx configs:

- `apps/host/nginx.conf`
- `apps/weekly-commit-remote/nginx.conf`

Required cache behavior:

- `/index.html`: no-cache
- `/remoteEntry.js`: no-cache on the remote service
- `/mf-entry-bootstrap-*.js`: no-cache on both host and remote services
- hashed files under `/assets/*`: immutable long cache

Keep remote CORS headers on:

- `/remoteEntry.js`
- `/mf-entry-bootstrap-*.js`
- `/assets/*`

The host does not need CORS for its own bootstrap, but matching cache behavior is still required.

### 7. Handle DTS Generation Deliberately

The plugin's default DTS generation fails in this monorepo because the generated DTS tsconfig uses the remote app as `rootDir`, while the app imports workspace source files through TypeScript path aliases.

Observed error class:

- `TYPE-001`
- `TS6059: File packages/shared-ui/src/index.ts is not under rootDir apps/weekly-commit-remote`

This does not block the Vite bundle, but it makes builds noisy and can slow them down. For this fix, set `dts: false` in both federation configs and keep the host-side manual module declaration. If remote type publishing becomes required later, add a dedicated federation DTS tsconfig whose `rootDir` includes the repo packages, or compile declarations from workspace packages first.

### 8. Keep Railway Env Exact

Host Railway service:

- `VITE_WEEKLY_COMMIT_REMOTE_URL=https://weekly-commit-remote-production.up.railway.app/remoteEntry.js`

Remote Railway service:

- no remote entry URL needed
- keep `VITE_API_BASE_URL` and existing app envs

Because Vite bakes `VITE_*` values at build time, changing `VITE_WEEKLY_COMMIT_REMOTE_URL` requires rebuilding and redeploying the host service.

## Validation Plan

### Local Dev

1. Start remote: `yarn dev:remote`
2. Start host: `yarn dev:host`
3. Visit `http://127.0.0.1:5174/` and confirm the standalone remote renders.
4. Visit `http://127.0.0.1:5173/app` and confirm the host renders the remote in-process instead of redirecting.
5. Confirm the browser console has no federation, React, or CORS errors.

Runtime probes on host `/app`:

- `globalThis.__FEDERATION__.__INSTANCES__` contains host and `weekly_commit_remote`
- `globalThis.__mf_module_cache__.remote["weekly_commit_remote/App"]` exists after `/app` loads
- The page leaves the Suspense fallback and renders the remote signed-out/persona UI

### Production-Like Build

Run:

- `yarn nx build host --skip-nx-cache`
- `yarn nx build weekly-commit-remote --skip-nx-cache`

Expected:

- no `TYPE-001` DTS error if `dts: false` is set
- host emits `mf-entry-bootstrap-0.js`
- remote emits `mf-entry-bootstrap-0.js` and root `remoteEntry.js`
- `remoteEntry.js` is small in `1.15.1`; the heavy runtime moves into assets

### Docker/Nginx Smoke

Build and run both Dockerfiles with production-like build args:

- `Dockerfile.remote`
- `Dockerfile.host`

Validate:

- remote `/` renders standalone
- remote `/remoteEntry.js` returns 200 with `Cache-Control: no-cache`
- remote `/mf-entry-bootstrap-0.js` returns 200 with no-cache, not immutable
- host `/app` renders the remote
- remote hashed chunks under `/assets/*` return immutable cache headers
- CORS headers are present on all remote JS/CSS chunks fetched by the host

### Railway Smoke

Deploy remote first, then host.

Validate:

- `https://weekly-commit-remote-production.up.railway.app/` renders standalone
- `https://weekly-commit-remote-production.up.railway.app/remoteEntry.js` returns no-cache
- `https://host-production-963c.up.railway.app/app` renders the remote without changing `window.location`
- host network tab fetches the remote's `remoteEntry.js` and remote assets from the remote origin
- no stale `mf-entry-bootstrap-0.js` is served after a redeploy

## Suggested Test Additions

Add a federation smoke test that runs against preview or Docker-served builds.

Minimum assertions:

- host `/app` does not redirect to the remote origin
- host `/app` eventually renders the remote signed-out/persona UI
- remote standalone root renders the same UI
- host loads the remote `remoteEntry.js`
- no console errors are emitted
- federation runtime contains both instances

This should be an explicit smoke test because unit tests will not catch the generated bootstrap graph.

## Implementation Order

1. Upgrade `@module-federation/vite` to exact `1.15.1` in both apps.
2. Re-enable remote federation config with `dts: false`.
3. Restore `federated-entry.tsx`.
4. Re-enable host federation config with `dts: false`.
5. Restore host `RemoteBoundary` dynamic import and `/app` route.
6. Remove or rephrase raw `import("weekly_commit_remote/App")` documentation/UI strings outside implementation files.
7. Add nginx no-cache handling for `mf-entry-bootstrap-*.js`.
8. Build both apps locally.
9. Run dev smoke.
10. Run Docker/nginx smoke.
11. Update CLAUDE/ADR/Architecture docs from "runtime deferred" to "runtime enabled".

## Open Decisions for Review

1. Whether to keep the remote's own Redux store in the federated wrapper for the demo, or move back toward the original host-owned auth-store contract. My recommendation is to keep the remote-owned wrapper for this fix because it preserves standalone mode and minimizes host coupling.
2. Whether to add explicit shared subpath entries for React, such as `react/` and `react-dom/`. The official docs show the `react/` pattern, and `1.15.1` has a specific shared-subpath fix. My recommendation is to include subpath sharing only if smoke tests show duplicate React/runtime chunks or hook identity issues; the first implementation can stay with the current pinned singleton set.
3. Whether to publish federated DTS. My recommendation is no for this iteration. Use `dts: false` and keep a manual host declaration until runtime is stable.

## Final Recommendation

Implement federation on `@module-federation/vite@1.15.1`, not `1.14.5`, and include the nginx bootstrap cache rule as part of the same change. The upgrade is not optional cleanup; it changes the generated runtime from the deadlocking top-level-await share-proxy model to an explicit bootstrap and module-cache model that fits this monorepo.
