import { expect, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

/**
 * Vitest setup file
 * Extends expect with Testing Library matchers and configures global test setup
 */

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Cleanup after each test case (e.g., clearing jsdom)
afterEach(() => {
  cleanup();
});
