/**
 * Wraps Playwright's base `test` with an auto-fixture that dumps
 * window.__coverage__ (populated by vite-plugin-istanbul, only active when
 * COVERAGE=true — see vite.config.ts) after each test into .nyc_output/,
 * where `npm run test:e2e:coverage` hands it to nyc for reporting.
 *
 * Every spec should import { test, expect } from here instead of
 * '@playwright/test' directly — it's a no-op passthrough when COVERAGE
 * isn't set, so normal `npm run test:e2e` runs pay no extra cost.
 */
import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// process.cwd() is the repo root — npm/playwright always run from there.
const COVERAGE_DIR = path.resolve(process.cwd(), '.nyc_output');

export const test = base.extend<{ collectCoverage: void }>({
  collectCoverage: [
    async ({ page }, use) => {
      await use();
      if (process.env.COVERAGE !== 'true') return;

      const coverage = await page.evaluate(() => (window as unknown as { __coverage__?: unknown }).__coverage__);
      if (!coverage) return;

      fs.mkdirSync(COVERAGE_DIR, { recursive: true });
      const file = path.join(COVERAGE_DIR, `${crypto.randomUUID()}.json`);
      fs.writeFileSync(file, JSON.stringify(coverage));
    },
    { auto: true },
  ],
});

export { expect };
