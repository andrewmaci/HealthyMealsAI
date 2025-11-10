import { Locator, Page } from "@playwright/test";

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
    await this.form.waitFor({ state: "visible" });
  }

  async fillForm(data: RecipeFormData) {
    await this.titleInput.fill(data.title);
    await this.servingsInput.fill(data.servings);

    for (const [key, value] of Object.entries(data.macros)) {
      await this.macroInputs[key as keyof RecipeFormData["macros"]].fill(value);
    }

    await this.instructionsTextarea.fill(data.instructions);

    if (data.explanation !== undefined) {
      await this.toggleAdvancedButton.click();
      await this.explanationTextarea.fill(data.explanation);
    }
  }

  async submit() {
    await this.submitButton.click();
  }
}
