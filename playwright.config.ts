import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: true,
  use: { baseURL: 'http://localhost:3000', browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  webServer: { command: 'npm run dev -- --hostname localhost', url: 'http://localhost:3000', reuseExistingServer: !process.env.CI },
});
