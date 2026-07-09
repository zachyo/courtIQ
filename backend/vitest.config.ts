import { defineConfig } from 'vitest/config';

// dotenv never overrides variables that are already set, so these win over .env
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://courtiq:courtiq@localhost:5432/courtiq_test';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      JWT_SECRET: 'test-secret',
    },
    globalSetup: './test/global-setup.ts',
    // All test files share one Postgres database — never run them in parallel
    fileParallelism: false,
    testTimeout: 15000,
  },
});
