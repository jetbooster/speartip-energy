// vite-plugin-eslint ships no types that resolve under bundler module resolution.
declare module 'vite-plugin-eslint' {
  import type { Plugin } from 'vite';
  export default function eslint(options?: Record<string, unknown>): Plugin;
}
