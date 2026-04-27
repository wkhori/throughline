import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// v1 deploy: federation disabled — see apps/host/vite.config.ts for rationale.
// The standalone bootstrap.tsx mounts WeeklyCommitApp directly, so the remote
// runs as its own Vite SPA at https://weekly-commit-remote-production.up.railway.app/.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, host: '127.0.0.1', cors: true },
  build: { target: 'esnext', modulePreload: false, cssCodeSplit: false },
});
