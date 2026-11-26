import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { msingiTtsPlugin } from './src/vite/msingiPlugin.js';
import { signPlanPlugin } from './src/vite/signPlanPlugin.js';

export default defineConfig({
  envDir: path.resolve(__dirname),
  plugins: [react(), msingiTtsPlugin(), signPlanPlugin()],
  resolve: {
    alias: {
      '@neema/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
});
