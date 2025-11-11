import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export interface RecipeFormData {
  title: string;
  servings: string;
  macros: {
    kcal: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  instructions: string;
  explanation?: string;
}

export class RecipeCreatePage extends BasePage {
  private readonly form: Locator;
  private readonly titleInput: Locator;
  private readonly servingsInput: Locator;
  private readonly macroInputs: Record<keyof RecipeFormData["macros"], Locator>;
  private readonly instructionsTextarea: Locator;
  private readonly toggleAdvancedButton: Locator;
  private readonly explanationTextarea: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId("recipe-form");
    this.titleInput = page.getByTestId("recipe-form-title-input");
    this.servingsInput = page.getByTestId("recipe-form-servings-input");
    this.macroInputs = {
      kcal: page.getByTestId("recipe-form-macro-kcal-input"),
      protein: page.getByTestId("recipe-form-macro-protein-input"),
      carbs: page.getByTestId("recipe-form-macro-carbs-input"),
      fat: page.getByTestId("recipe-form-macro-fat-input"),
    };
    this.instructionsTextarea = page.getByTestId("recipe-form-instructions-textarea");
    this.toggleAdvancedButton = page.getByTestId("recipe-form-toggle-advanced-button");
    this.explanationTextarea = page.getByTestId("recipe-form-explanation-textarea");
    this.submitButton = page.getByTestId("recipe-form-submit-button");
  }

  async goto() {
    await super.goto("/recipes/new");
    await this.waitForReady();
  }

  async waitForReady() {
    // Wait for form to be visible
    await this.form.waitFor({ state: "visible" });

    // Wait for React hydration and any initial data loading
    await this.page.waitForLoadState("networkidle");

    // Ensure key form elements are ready
    await this.titleInput.waitFor({ state: "visible" });
    await this.submitButton.waitFor({ state: "visible" });
  }

  async fillForm(data: RecipeFormData) {
    // Wait for inputs to be enabled before filling
    await this.titleInput.waitFor({ state: "visible" });
    await this.titleInput.fill(data.title);

    await this.servingsInput.waitFor({ state: "visible" });
    await this.servingsInput.fill(data.servings);

    for (const [key, value] of Object.entries(data.macros)) {
      const input = this.macroInputs[key as keyof RecipeFormData["macros"]];
      await input.waitFor({ state: "visible" });
      await input.fill(value);
    }

    await this.instructionsTextarea.waitFor({ state: "visible" });
    await this.instructionsTextarea.fill(data.instructions);

    if (data.explanation !== undefined) {
      await this.toggleAdvancedButton.waitFor({ state: "visible" });
      await this.toggleAdvancedButton.click();

      // Wait for the explanation textarea to appear (it might be hidden initially)
      await this.explanationTextarea.waitFor({ state: "visible", timeout: 5000 });
      await this.explanationTextarea.fill(data.explanation);
    }
  }

  async submit() {
    // Ensure submit button is visible and enabled before clicking
    await this.submitButton.waitFor({ state: "visible" });
    await this.submitButton.isEnabled({ timeout: 5000 });

    // Click and wait for navigation to recipe detail page
    await Promise.all([this.page.waitForURL(/\/recipes\/[\w-]+/, { timeout: 15000 }), this.submitButton.click()]);
  }
}
