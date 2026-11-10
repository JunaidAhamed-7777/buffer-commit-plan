import { defineConfig } from '@playwright/test';

const origin = 'http://127.0.0.1:3191';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.pw.ts',
  timeout: 60_000,
  use: { baseURL: origin, browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3191',
    url: origin,
    timeout: 60_000,
    env: { PATCHWORK_DB_PATH: ':memory:', BUFFER_CLIENT_ID: '', BUFFER_CLIENT_SECRET: '', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
