import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class RecipesListPage extends BasePage {
  private readonly container: Locator;
  private readonly createRecipeButton: Locator;

  constructor(page: Page) {
    super(page);
    this.container = page.getByTestId("recipes-list-view");
    this.createRecipeButton = page.getByTestId("recipes-create-button");
  }

  async goto() {
    await super.goto("/recipes");
    await this.waitForReady();
  }

  async waitForReady() {
    // Wait for container to be visible
    await this.container.waitFor({ state: "visible" });

    // Wait for any pending network requests to complete (React hydration, data fetching, etc.)
    await this.page.waitForLoadState("networkidle");

    // Ensure the create button is ready to interact
    await this.createRecipeButton.waitFor({ state: "visible" });
  }

  async openCreateRecipeForm() {
    // Wait for the button to be visible and enabled
    await this.createRecipeButton.waitFor({ state: "visible" });

    // Ensure the button is not disabled using Playwright's built-in checks
    await this.createRecipeButton.isEnabled({ timeout: 5000 });

    // Click and wait for navigation to complete
    await Promise.all([this.page.waitForURL(/\/recipes\/new/, { timeout: 10000 }), this.createRecipeButton.click()]);
  }
}
