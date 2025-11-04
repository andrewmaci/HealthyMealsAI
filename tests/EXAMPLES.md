# Test Examples for HealthyMealsAI

This document provides practical examples of how to test different parts of your application.

## Testing React Components

### Testing UI Components (Button)

```typescript
// tests/unit/components/ui/button.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render with correct text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('should call onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Testing Form Components

```typescript
// tests/unit/components/auth/SignInForm.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SignInForm } from '@/components/auth/SignInForm';

describe('SignInForm', () => {
  it('should validate email format', async () => {
    const user = userEvent.setup();
    render(<SignInForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    await user.type(emailInput, 'invalid-email');
    await user.tab(); // Trigger blur event
    
    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });

  it('should submit form with valid credentials', async () => {
    const handleSubmit = vi.fn();
    const user = userEvent.setup();
    
    render(<SignInForm onSubmit={handleSubmit} />);
    
    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
    
    expect(handleSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });
});
```

## Testing Services

### Testing API Service

```typescript
// tests/unit/lib/api.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '../setup/msw.setup';
import { http, HttpResponse } from 'msw';
import { apiClient } from '@/lib/api';

describe('API Client', () => {
  it('should fetch recipes successfully', async () => {
    // Mock the API response
    server.use(
      http.get('/api/recipes', () => {
        return HttpResponse.json([
          { id: '1', name: 'Pasta', cuisine: 'Italian' },
          { id: '2', name: 'Sushi', cuisine: 'Japanese' },
        ]);
      })
    );

    const recipes = await apiClient.getRecipes();
    
    expect(recipes).toHaveLength(2);
    expect(recipes[0]).toHaveProperty('name', 'Pasta');
  });

  it('should handle API errors', async () => {
    server.use(
      http.get('/api/recipes', () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    await expect(apiClient.getRecipes()).rejects.toThrow();
  });
});
```

### Testing Recipe Service

```typescript
// tests/unit/lib/services/recipe.service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { RecipeService } from '@/lib/services/recipe.service';

describe('RecipeService', () => {
  it('should create a new recipe', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{ id: '1', name: 'New Recipe' }],
            error: null,
          }),
        }),
      }),
    };

    const service = new RecipeService(mockSupabase as any);
    const result = await service.createRecipe({
      name: 'New Recipe',
      cuisine: 'Italian',
    });

    expect(result).toHaveProperty('id', '1');
    expect(mockSupabase.from).toHaveBeenCalledWith('recipes');
  });
});
```

## Testing Custom Hooks

```typescript
// tests/unit/components/hooks/useRecipeDetail.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecipeDetail } from '@/components/hooks/useRecipeDetail';
import { server } from '../../setup/msw.setup';
import { http, HttpResponse } from 'msw';

describe('useRecipeDetail', () => {
  it('should fetch recipe details', async () => {
    server.use(
      http.get('/api/recipes/:id', ({ params }) => {
        return HttpResponse.json({
          id: params.id,
          name: 'Test Recipe',
          ingredients: ['ingredient 1', 'ingredient 2'],
        });
      })
    );

    const { result } = renderHook(() => useRecipeDetail('123'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.recipe).toHaveProperty('name', 'Test Recipe');
  });

  it('should handle errors', async () => {
    server.use(
      http.get('/api/recipes/:id', () => {
        return new HttpResponse(null, { status: 404 });
      })
    );

    const { result } = renderHook(() => useRecipeDetail('invalid-id'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });
});
```

## E2E Tests

### Testing Authentication Flow

```typescript
// tests/e2e/auth-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should complete sign up process', async ({ page }) => {
    await page.goto('/auth/signup');
    
    // Fill in the form
    await page.fill('input[name="email"]', 'newuser@example.com');
    await page.fill('input[name="password"]', 'SecurePass123!');
    await page.fill('input[name="confirmPassword"]', 'SecurePass123!');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Verify redirect to home or profile
    await expect(page).toHaveURL(/\/(profile)?/);
    
    // Check for success message
    await expect(page.getByText(/welcome/i)).toBeVisible();
  });

  test('should sign in existing user', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', 'existing@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/');
  });

  test('should handle invalid credentials', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });
});
```

### Testing Recipe Management

```typescript
// tests/e2e/recipe-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Recipe Management', () => {
  test.beforeEach(async ({ page }) => {
    // Assume user is already authenticated
    await page.goto('/recipes');
  });

  test('should create a new recipe', async ({ page }) => {
    await page.click('text=New Recipe');
    
    await page.fill('input[name="name"]', 'Spaghetti Carbonara');
    await page.fill('textarea[name="ingredients"]', 'Pasta\nEggs\nBacon\nCheese');
    await page.fill('textarea[name="instructions"]', '1. Boil pasta\n2. Mix ingredients');
    
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL(/\/recipes\/\d+/);
    await expect(page.getByRole('heading', { name: /Spaghetti Carbonara/i })).toBeVisible();
  });

  test('should search for recipes', async ({ page }) => {
    await page.fill('input[placeholder*="Search"]', 'pasta');
    await page.press('input[placeholder*="Search"]', 'Enter');
    
    // Wait for search results
    await page.waitForSelector('[data-testid="recipe-card"]');
    
    const recipeCards = page.locator('[data-testid="recipe-card"]');
    await expect(recipeCards).toHaveCountGreaterThan(0);
  });

  test('should filter recipes by cuisine', async ({ page }) => {
    await page.click('button:has-text("Filter")');
    await page.click('text=Italian');
    
    await page.waitForSelector('[data-testid="recipe-card"]');
    
    const cuisineLabels = page.locator('[data-testid="recipe-cuisine"]');
    const count = await cuisineLabels.count();
    
    for (let i = 0; i < count; i++) {
      await expect(cuisineLabels.nth(i)).toHaveText('Italian');
    }
  });
});
```

### Testing with Page Object Model

```typescript
// tests/e2e/recipe-pom.spec.ts
import { test, expect } from '@playwright/test';
import { HomePage } from './pages/HomePage';

test.describe('Recipe Management with POM', () => {
  test('should navigate to recipes page', async ({ page }) => {
    const homePage = new HomePage(page);
    
    await homePage.goto();
    await expect(homePage.isDisplayed()).resolves.toBe(true);
    
    // Navigate to recipes
    await page.click('a[href="/recipes"]');
    await expect(page).toHaveURL('/recipes');
  });
});
```

## Testing API Endpoints (Using Playwright)

```typescript
// tests/e2e/api/recipes-api.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Recipes API', () => {
  test('GET /api/recipes should return recipes list', async ({ request }) => {
    const response = await request.get('/api/recipes');
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const recipes = await response.json();
    expect(Array.isArray(recipes)).toBe(true);
  });

  test('POST /api/recipes should create a new recipe', async ({ request }) => {
    const newRecipe = {
      name: 'Test Recipe',
      cuisine: 'Italian',
      ingredients: ['ingredient 1', 'ingredient 2'],
    };

    const response = await request.post('/api/recipes', {
      data: newRecipe,
    });

    expect(response.ok()).toBeTruthy();
    const recipe = await response.json();
    expect(recipe).toHaveProperty('id');
    expect(recipe.name).toBe('Test Recipe');
  });

  test('GET /api/recipes/:id should return recipe details', async ({ request }) => {
    const response = await request.get('/api/recipes/1');
    
    expect(response.ok()).toBeTruthy();
    const recipe = await response.json();
    expect(recipe).toHaveProperty('id', '1');
    expect(recipe).toHaveProperty('name');
  });
});
```

## Testing with Visual Regression

```typescript
// tests/e2e/visual/components.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Visual Regression Tests', () => {
  test('recipe card should match snapshot', async ({ page }) => {
    await page.goto('/recipes');
    
    const recipeCard = page.locator('[data-testid="recipe-card"]').first();
    await expect(recipeCard).toHaveScreenshot('recipe-card.png');
  });

  test('recipe detail page should match snapshot', async ({ page }) => {
    await page.goto('/recipes/1');
    await expect(page).toHaveScreenshot('recipe-detail-page.png', {
      fullPage: true,
    });
  });
});
```

## Tips for Writing Good Tests

### Unit Tests
1. **Test behavior, not implementation** - Focus on what the component does
2. **Use meaningful test descriptions** - Make tests self-documenting
3. **Keep tests isolated** - Each test should be independent
4. **Mock external dependencies** - Don't make real API calls
5. **Test edge cases** - Empty states, errors, loading states

### E2E Tests
1. **Test user journeys** - Test complete flows, not just individual actions
2. **Use data-testid for stability** - More reliable than CSS selectors
3. **Wait for elements** - Use Playwright's auto-waiting features
4. **Test across devices** - Use different viewport sizes
5. **Keep tests maintainable** - Use Page Object Model for complex tests

## Running Specific Tests

```bash
# Run a specific test file
npm run test:unit -- tests/unit/components/Button.test.tsx

# Run tests matching a pattern
npm run test:unit -- -t "Button Component"

# Run tests in a specific directory
npm run test:unit -- tests/unit/components/

# Run E2E tests for a specific file
npm run test:e2e -- tests/e2e/auth-flow.spec.ts

# Run E2E tests matching a pattern
npm run test:e2e -- --grep "authentication"
```

