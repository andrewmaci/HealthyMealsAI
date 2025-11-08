import { test, expect } from '@playwright/test';

/**
 * Example E2E test using Playwright
 * Following Page Object Model pattern
 */

test.describe.skip('Example Health Check', () => {
  test('should return ok status', async ({ page }) => {
    // Navigate to the health endpoint
    const response = await page.request.get('/api/health');
    
    // Verify response
    expect(response.ok()).toBeTruthy();
    
    // Parse JSON response
    const data = await response.json();
    expect(data).toHaveProperty('status');
  });

  test('should load the home page', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Verify page title or content
    await expect(page).toHaveTitle(/HealthyMealsAI/i);
  });
});

