import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/tests/agent/**',  // エージェントは npm run agent で個別実行
    ],
  },
});
