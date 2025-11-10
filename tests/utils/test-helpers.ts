import { vi, beforeEach, afterEach } from "vitest";

/**
 * Common test utilities and helpers
 * Reusable functions for testing
 */

/**
 * Wait for a specified amount of time
 * Useful for testing time-dependent behavior
 */
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a random string
 * Useful for generating unique test data
 */
export const randomString = (length = 10): string => {
  return Math.random()
    .toString(36)
    .substring(2, length + 2);
};

/**
 * Generate a random email
 * Useful for testing forms and authentication
 */
export const randomEmail = (): string => {
  return `test-${randomString(8)}@example.com`;
};

/**
 * Create a mock function that returns different values on consecutive calls
 */
export const mockSequence = <T>(...values: T[]) => {
  let index = 0;
  return vi.fn(() => {
    const value = values[index];
    index = (index + 1) % values.length;
    return value;
  });
};

/**
 * Suppress console errors in tests
 * Useful when testing error scenarios
 */
export const suppressConsoleError = () => {
  const originalError = console.error;
  beforeEach(() => {
    console.error = vi.fn();
  });
  afterEach(() => {
    console.error = originalError;
  });
};
