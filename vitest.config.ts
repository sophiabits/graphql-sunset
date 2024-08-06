import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
    },
    root: '.',
    bail: 1,
    maxConcurrency: 1,
  },
});
