import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sharedDeps = JSON.parse(
  readFileSync(resolve(__dirname, '../../packages/shared-deps-versions.json'), 'utf-8'),
) as Record<string, string>;

// Workspace-source packages aren't federation singletons — each consumer bundles its own copy.
const SHARED_SKIP = new Set(['@throughline/shared-ui', '@throughline/shared-types']);
const sharedSingletons = Object.fromEntries(
  Object.entries(sharedDeps)
    .filter(([k]) => !k.startsWith('_') && !SHARED_SKIP.has(k))
    .map(([name, requiredVersion]) => [
      name,
      { singleton: true, requiredVersion: requiredVersion as string },
    ]),
);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'weekly_commit_remote',
      filename: 'remoteEntry.js',
      exposes: { './App': './src/federated-entry.tsx' },
      shared: sharedSingletons,
      dts: false,
    }),
  ],
  server: { port: 5174, host: '127.0.0.1', cors: true, origin: 'http://127.0.0.1:5174' },
  build: { target: 'chrome89' },
  optimizeDeps: { esbuildOptions: { target: 'chrome89' } },
});
