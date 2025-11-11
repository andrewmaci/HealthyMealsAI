import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vitest configuration for unit and component testing
 * Following best practices from the cursor rules
 */
export default defineConfig({
  plugins: [react()],
  test: {
    // Enable jsdom for DOM testing
    environment: "jsdom",

    // Setup files to run before each test file
    setupFiles: ["./tests/setup/vitest.setup.ts"],

    // Global test configuration
    globals: true,

    // Include only unit tests
    include: ["tests/unit/**/*.{test,spec}.{ts,tsx}"],

    // Exclude E2E tests
    exclude: ["tests/e2e/**/*", "node_modules/**/*", "dist/**/*"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "dist/",
        "*.config.ts",
        "*.config.js",
        ".astro/",
        "src/env.d.ts",
        "src/db/database.types.ts",
      ],
    },

    // Inline snapshots
    resolveSnapshotPath: (testPath, snapExtension) => {
      return testPath + snapExtension;
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
