import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/agent/run.test.ts'],
    reporters: ['verbose'],
  },
});
