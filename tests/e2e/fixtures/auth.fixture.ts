import { test as base } from '@playwright/test';

/**
 * Custom fixtures for authentication
 * Example of how to create reusable test fixtures
 */

type AuthFixtures = {
  authenticatedPage: any;
};

/**
 * Extend base test with custom fixtures
 * This is useful for setting up common test scenarios
 */
export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Setup: Perform authentication
    // Example: Set auth cookies, localStorage, etc.
    
    // Use the authenticated page in tests
    await use(page);
    
    // Teardown: Clean up if needed
  },
});

export { expect } from '@playwright/test';

