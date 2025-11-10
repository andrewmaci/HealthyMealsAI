import { describe, it, expect, vi } from "vitest";

/**
 * Example unit test using Vitest
 * Demonstrates basic test structure and mocking
 */

describe("Example Test Suite", () => {
  it("should pass a basic assertion", () => {
    expect(true).toBe(true);
  });

  it("should work with mocks", () => {
    const mockFn = vi.fn(() => "mocked value");

    const result = mockFn();

    expect(mockFn).toHaveBeenCalledOnce();
    expect(result).toBe("mocked value");
  });

  it("should handle async operations", async () => {
    const asyncFn = async () => {
      return Promise.resolve("async result");
    };

    const result = await asyncFn();

    expect(result).toBe("async result");
  });
});
