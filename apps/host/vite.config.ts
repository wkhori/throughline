import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// v1 deploy note: @module-federation/vite 1.14.5 emits a circular import
// between the shared-package chunks and their loadShare proxies, deadlocking
// every top-level await on the host and blocking React mount. Since the
// host's RemoteBoundary is a Phase 0 static placeholder that never actually
// imports the federated remote, federation is unused at runtime. Building
// host as a plain Vite SPA unblocks v1 — federation can be reintroduced once
// the remote is genuinely consumed (and the upstream cycle is resolved).
// See docs/architecture-decisions.md (to be updated).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: '127.0.0.1' },
  build: { target: 'esnext', modulePreload: false, cssCodeSplit: false },
});
