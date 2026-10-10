import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub's Windows and Mac machines are much slower than a laptop: generous timeouts for the I/O-heavy tests.
  test: { environment: 'node', testTimeout: 30_000, hookTimeout: 30_000 },
} as Parameters<typeof defineConfig>[0]);
