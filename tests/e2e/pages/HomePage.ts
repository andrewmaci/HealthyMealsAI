import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Page Object Model for the Home Page
 * Example implementation following Playwright best practices
 */
export class HomePage extends BasePage {
  // Locators - define element selectors
  private readonly heading: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { level: 1 });
  }

  /**
   * Navigate to the home page
   */
  async goto() {
    await super.goto('/');
    await this.waitForLoad();
  }

  /**
   * Get the main heading text
   */
  async getHeadingText(): Promise<string | null> {
    return await this.heading.textContent();
  }

  /**
   * Check if home page is displayed
   */
  async isDisplayed(): Promise<boolean> {
    return await this.heading.isVisible();
  }
}

