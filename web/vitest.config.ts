import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@gameclaw\/gamekit$/, replacement: r('../packages/gamekit/src/core.ts') },
      { find: /^@games\//, replacement: `${r('../games')}/` },
    ],
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
