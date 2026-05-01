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

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'weekly_commit_remote',
      filename: 'remoteEntry.js',
      exposes: {
        './App': './src/federated-entry.tsx',
      },
      shared: sharedSingletons,
    }),
  ],
  server: { port: 5174, host: '127.0.0.1', cors: true, origin: 'http://127.0.0.1:5174' },
  build: { target: 'esnext', modulePreload: false },
});
