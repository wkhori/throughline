import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import sharedDeps from '../../packages/shared-deps-versions.json' with { type: 'json' };

const sharedSingletons = Object.fromEntries(
  Object.entries(sharedDeps)
    .filter(([k]) => !k.startsWith('_'))
    .map(([name, version]) => [name, { singleton: true, requiredVersion: version as string }]),
);

// Railway sets VITE_WEEKLY_COMMIT_REMOTE_URL on the host service to the
// deployed remote's remoteEntry.js. Falls back to local dev URL.
const REMOTE_ENTRY =
  process.env.VITE_WEEKLY_COMMIT_REMOTE_URL ?? 'http://127.0.0.1:5174/remoteEntry.js';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'host',
      remotes: {
        weekly_commit_remote: {
          type: 'module',
          name: 'weekly_commit_remote',
          entry: REMOTE_ENTRY,
          entryGlobalName: 'weekly_commit_remote',
          shareScope: 'default',
        },
      },
      shared: sharedSingletons,
    }),
  ],
  server: {
    port: 5173,
    host: '127.0.0.1',
    origin: 'http://127.0.0.1:5173',
    // Editor / build-side TypeScript writes .d.ts files into shared-ui's src tree
    // (gitignored). Watching them triggers a reload storm in dev when both host
    // and remote are running. Ignore them at the watcher level.
    watch: { ignored: ['**/*.d.ts', '**/*.d.ts.map'] },
  },
  build: { target: 'esnext', modulePreload: false },
});
