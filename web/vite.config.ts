import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * The portal bundles each game's deterministic state machine straight from
 * `games/<id>/src`. `@gameclaw/gamekit` is aliased to its browser-safe `core`
 * entry so no `node:*` module ever reaches the bundle.
 */
export default defineConfig({
  base: process.env.GAMECLAW_BASE ?? '/gameclaw/',
  resolve: {
    alias: [
      { find: /^@gameclaw\/gamekit$/, replacement: r('../packages/gamekit/src/core.ts') },
      { find: /^@games\//, replacement: `${r('../games')}/` },
    ],
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
    cssCodeSplit: true,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1200,
    modulePreload: { polyfill: false },
  },
  server: { port: 5173 },
});
