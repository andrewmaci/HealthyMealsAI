import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

/**
 * Playwright configuration for E2E testing
 * Following best practices from the cursor rules
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalTeardown: "./tests/e2e/global-teardown.ts",

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests on CI to handle transient failures
  // With robust waiting strategies in place, retries handle genuine network/infrastructure issues
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI for stability
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [["html"], ["list"]],

  // Shared settings for all the projects below
  use: {
    testIdAttribute: "data-test-id",
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: process.env.BASE_URL || "http://localhost:3000",

    // Collect trace on failure for debugging (includes network, console, DOM snapshots)
    trace: process.env.CI ? "retain-on-failure" : "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",

    // Video on failure for CI debugging
    video: process.env.CI ? "retain-on-failure" : "on-first-retry",
  },

  // Configure projects for major browsers (Chromium only as per cursor rules)
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: process.env.CI ? "npm run dev:e2e" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
