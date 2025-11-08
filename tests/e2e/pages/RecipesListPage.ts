import { Locator, Page } from "@playwright/test";

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
    await this.container.waitFor({ state: "visible" });
  }

  async openCreateRecipeForm() {
    await this.createRecipeButton.click();
  }
}
