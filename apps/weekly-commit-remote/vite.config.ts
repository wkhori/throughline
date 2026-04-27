import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { federation } from '@module-federation/vite';
import sharedDeps from '../../packages/shared-deps-versions.json';

const requiredVersion = (name: keyof typeof sharedDeps): string => {
  const v = sharedDeps[name];
  if (typeof v !== 'string') throw new Error(`shared-deps-versions.json missing ${name}`);
  return v;
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    federation({
      name: 'weeklyCommit',
      filename: 'remoteEntry.js',
      exposes: {
        './WeeklyCommitApp': './src/WeeklyCommitApp.tsx',
        './WeeklyCommitRoutes': './src/WeeklyCommitRoutes.tsx',
        './api-slice': './src/api/api.ts',
      },
      shared: {
        react: { singleton: true, requiredVersion: requiredVersion('react') },
        'react-dom': { singleton: true, requiredVersion: requiredVersion('react-dom') },
        'react-router-dom': { singleton: true, requiredVersion: requiredVersion('react-router-dom') },
        '@reduxjs/toolkit': { singleton: true, requiredVersion: requiredVersion('@reduxjs/toolkit') },
        'react-redux': { singleton: true, requiredVersion: requiredVersion('react-redux') },
        '@throughline/shared-ui': { singleton: true, requiredVersion: requiredVersion('@throughline/shared-ui') },
        '@throughline/shared-types': { singleton: true, requiredVersion: requiredVersion('@throughline/shared-types') },
      },
    }),
  ],
  server: { port: 5174, host: '127.0.0.1', cors: true },
  build: { target: 'esnext', modulePreload: false, cssCodeSplit: false },
});
