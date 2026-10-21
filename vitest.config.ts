import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Each test file builds its own app/store, so parallel files are isolated.
    testTimeout: 15_000,
  },
});
