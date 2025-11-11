import type { Locator, Page } from "@playwright/test";

import { BasePage } from "./BasePage";

export class SignInPage extends BasePage {
  private readonly form: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId("auth-signin-form");
    this.emailInput = page.getByTestId("auth-signin-email-input");
    this.passwordInput = page.getByTestId("auth-signin-password-input");
    this.submitButton = page.getByTestId("auth-signin-submit-button");
  }

  async goto() {
    await super.goto("/auth/signin");
    await this.waitForReady();
  }

  async waitForReady() {
    // Wait for form to be visible
    await this.form.waitFor({ state: "visible" });

    // Wait for React hydration and network idle
    await this.page.waitForLoadState("networkidle");

    // Ensure form inputs are ready
    await this.emailInput.waitFor({ state: "visible" });
    await this.submitButton.waitFor({ state: "visible" });
  }

  async signIn(email: string, password: string) {
    // Wait for email input to be ready and fill
    await this.emailInput.waitFor({ state: "visible" });
    await this.emailInput.fill(email);

    // Wait for password input to be ready and fill
    await this.passwordInput.waitFor({ state: "visible" });
    await this.passwordInput.fill(password);

    // Ensure submit button is enabled before clicking
    await this.submitButton.waitFor({ state: "visible" });
    await this.submitButton.isEnabled({ timeout: 5000 });

    // Click and wait for navigation to recipes page
    await Promise.all([this.page.waitForURL(/\/recipes(?:\/.*)?$/, { timeout: 10000 }), this.submitButton.click()]);
  }
}
