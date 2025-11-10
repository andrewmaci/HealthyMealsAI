import { expect, test } from '@playwright/test';

import { RecipeCreatePage } from './pages/RecipeCreatePage';
import { RecipesListPage } from './pages/RecipesListPage';
import { SignInPage } from './pages/SignInPage';

test.describe('Recipes - Create flow', () => {
  test('user can create a new recipe', async ({ page }) => {
    const email =  process.env.E2E_USERNAME;
    const password = process.env.E2E_PASSWORD;

    if (!email || !password) {
      throw new Error('Set TEST_USER_EMAIL/TEST_USER_PASSWORD or E2E_USERNAME/E2E_PASSWORD in the environment for E2E tests.');
    }

    const signInPage = new SignInPage(page);
    await signInPage.goto();
    await signInPage.signIn(email, password);
    await expect(page).toHaveURL(/\/recipes(?:\/?|\/.*)$/);

    const listPage = new RecipesListPage(page);
    await listPage.waitForReady();
    await listPage.openCreateRecipeForm();

    const createPage = new RecipeCreatePage(page);
    await createPage.waitForReady();

    const uniqueSuffix = Date.now();
    const formData = {
      title: `Automated Test Recipe ${uniqueSuffix}`,
      servings: '2',
      macros: {
        kcal: '450',
        protein: '30',
        carbs: '50',
        fat: '15',
      },
      instructions: '1. Prepare ingredients.\n2. Cook according to instructions.\n3. Serve and enjoy.',
      explanation: 'Automated test run',
    } as const;

    await createPage.fillForm(formData);
    await createPage.submit();

    await expect(page).toHaveURL(/\/recipes\/[\w-]+/);
  });
});


