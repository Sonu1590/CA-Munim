import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8081',
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
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
