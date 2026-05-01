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

const REMOTE_ENTRY =
  process.env.VITE_REMOTE_ENTRY ?? 'http://127.0.0.1:5174/remoteEntry.js';

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
  server: { port: 5173, host: '127.0.0.1', origin: 'http://127.0.0.1:5173' },
  build: { target: 'esnext', modulePreload: false },
});
