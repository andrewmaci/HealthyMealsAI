import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

/**
 * MSW (Mock Service Worker) setup for API mocking
 * Use this in your tests to mock API requests
 */

// Define request handlers
export const handlers = [
  // Example handler - replace with your actual API endpoints
  http.get("/api/health", () => {
    return HttpResponse.json({ status: "ok" });
  }),
];

// Setup MSW server
export const server = setupServer(...handlers);

// Start server before all tests
export function setupMSW() {
  server.listen({ onUnhandledRequest: "warn" });
}

// Reset handlers after each test
export function resetMSW() {
  server.resetHandlers();
}

// Clean up after all tests
export function teardownMSW() {
  server.close();
}
