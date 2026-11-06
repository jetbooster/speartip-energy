import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';
import { defineConfig } from 'vitest/config';

// Frontend tests only, run in real Chromium. Server tests use `bun test` (see package.json).
export default defineConfig({
  root: './src',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  // Bundled up front, because discovering these mid-run can load a second copy of React.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-dev-runtime',
      '@emotion/react',
      '@emotion/styled',
      '@mui/material',
      '@mui/icons-material',
      '@mui/x-charts',
    ],
  },
  test: {
    include: ['**/*.test.{ts,tsx}'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
    },
  },
});
