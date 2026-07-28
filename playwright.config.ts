import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';

// Nothing else in this repo auto-loads e2e/.env.test — helpers/auth.ts's
// requireTestEnv() reads TEST_USER_EMAIL/TEST_USER_PASSWORD straight from
// process.env, so without this every run needs them exported manually.
//
// quiet: true suppresses dotenv's own stdout line on every load. Since
// v17.4.x that line rotates through promotional "tips" for the package
// author's other projects (dotenvx.com, vestauth.com) — two of which are
// explicitly worded "for agents", i.e. aimed at AI coding assistants
// reading test/build output rather than the human running the tests. This
// has already been publicly flagged as a supply-chain prompt-injection
// concern (see github.com/BeMySlaveDarlin/cc-bootstrapper issue #1).
// Suppressing it here is just noise reduction — nothing in this repo acts
// on that output — but there's no reason to keep printing it.
config({ path: 'e2e/.env.test', quiet: true });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // CA Munim tests share DB state — run sequentially
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // single worker — avoid race conditions on shared Supabase test data
  timeout: 30_000,
  expect: { timeout: 8_000 },

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'], // terminal output
  ],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',

    // Indian locale — DD/MM/YYYY dates
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },

  projects: [
    // Desktop Chrome — primary
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile — CAs use phones heavily
    {
      name: 'mobile-android',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-ios',
      use: { ...devices['iPhone 14'] },
    },
  ],

  // Start the local dev server automatically before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
