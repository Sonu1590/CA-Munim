/**
 * e2e/helpers/utils.ts
 * Utility functions shared across test suites
 */

/**
 * Returns current Indian Financial Year string.
 * e.g. "FY 2026-27" when called in June 2026
 */
export function getCurrentFY(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  if (month >= 4) {
    return `FY ${year}-${String(year + 1).slice(-2)}`;
  }
  return `FY ${year - 1}-${String(year).slice(-2)}`;
}

/**
 * Returns a date string in YYYY-MM-DD format
 * offset is number of days from today (negative = past)
 */
export function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/**
 * Format a number as Indian currency string
 */
export function formatINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Generate a unique test string to avoid collisions
 */
export function unique(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Generate a valid test PAN number (fake but valid format)
 */
export function fakePAN(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rand = (n: number) => Math.floor(Math.random() * n);
  return (
    letters[rand(26)] +
    letters[rand(26)] +
    letters[rand(26)] +
    'P' + // P = Individual
    letters[rand(26)] +
    String(rand(9) + 1) +
    rand(10) + rand(10) + rand(10) +
    letters[rand(26)]
  );
}

/**
 * Generate a valid 10-digit Indian mobile number (starts with 6-9)
 */
export function fakePhone(): string {
  const starts = ['6', '7', '8', '9'];
  const start = starts[Math.floor(Math.random() * starts.length)];
  let rest = '';
  for (let i = 0; i < 9; i++) rest += Math.floor(Math.random() * 10);
  return start + rest;
}
