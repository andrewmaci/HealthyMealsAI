import { test as base } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * Custom fixtures for authentication
 * Example of how to create reusable test fixtures
 */

interface AuthFixtures {
  authenticatedPage: Page;
}

/**
 * Extend base test with custom fixtures
 * This is useful for setting up common test scenarios
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, applyAuthenticatedPage) => {
    // Setup: Perform authentication
    // Example: Set auth cookies, localStorage, etc.

    // Use the authenticated page in tests
    await applyAuthenticatedPage(page);

    // Teardown: Clean up if needed
  },
});

export { expect } from "@playwright/test";
