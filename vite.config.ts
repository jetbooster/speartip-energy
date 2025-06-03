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
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:29999',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api\/v1/, ""),
      },
    },
    port: 9000,
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },

});
