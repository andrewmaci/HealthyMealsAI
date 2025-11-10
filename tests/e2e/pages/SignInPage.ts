import type { Locator, Page } from '@playwright/test';

import { BasePage } from './BasePage';

export class SignInPage extends BasePage {
  private readonly form: Locator;
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.form = page.getByTestId('auth-signin-form');
    this.emailInput = page.getByTestId('auth-signin-email-input');
    this.passwordInput = page.getByTestId('auth-signin-password-input');
    this.submitButton = page.getByTestId('auth-signin-submit-button');
  }

  async goto() {
    await super.goto('/auth/signin');
    await this.waitForReady();
  }

  async waitForReady() {
    await this.form.waitFor({ state: 'visible' });
  }

  async signIn(email: string, password: string) {
    await this.emailInput.click()
    await this.emailInput.fill(email);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.passwordInput.click()
    await this.passwordInput.fill(password);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.submitButton.focus();
    await this.submitButton.press('Enter');
  }
}


