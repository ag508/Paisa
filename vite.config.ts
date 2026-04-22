import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The `base` is set at build time so the app works both locally (`/`) and
// under a GitHub Pages project path (`/<repo>/`). The Actions workflow
// passes VITE_BASE=/<repo>/ at build time.
export default defineConfig(() => ({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
}));
