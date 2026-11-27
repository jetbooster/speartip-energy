import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import eslint from 'vite-plugin-eslint';

// https://vite.dev/config/
export default defineConfig({
  root: './src',
  envDir: '../',
  plugins: [
    react(),
    eslint(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  server: {
    proxy: {
      // The backend to talk to. scripts/dev.ts sets this for the remote and mock modes.
      '/api': {
        target: process.env.API_TARGET ?? 'http://127.0.0.1:29999',
        changeOrigin: true,
      },
    },
    port: 9000,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },

});
