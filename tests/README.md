# Testing Guide

This directory contains the test suite for HealthyMealsAI, including both unit tests and end-to-end (E2E) tests.

## Tech Stack

- **Vitest** - Unit and component testing
- **React Testing Library** - React component testing utilities
- **Playwright** - End-to-end testing
- **MSW (Mock Service Worker)** - API mocking

## Directory Structure

```
tests/
├── setup/              # Test setup and configuration
│   ├── vitest.setup.ts # Vitest global setup
│   └── msw.setup.ts    # MSW configuration
├── unit/               # Unit tests
│   └── components/     # React component tests
└── e2e/                # End-to-end tests
```

## Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run tests in watch mode (recommended for development)
npm run test:unit:watch

# Run tests with UI (visual test explorer)
npm run test:unit:ui

# Run tests with coverage report
npm run test:unit:coverage
```

### E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI mode
npm run test:e2e:ui

# Run E2E tests in headed mode (see browser)
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug
```

### Run All Tests

```bash
npm run test:all
```

## Writing Tests

### Unit Tests

Place unit tests in `tests/unit/` with the `.test.ts` or `.test.tsx` extension.

#### Example: Testing a utility function

```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from '@/lib/utils';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

#### Example: Testing a React component

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MyComponent } from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('should handle user interaction', async () => {
    const user = userEvent.setup();
    render(<MyComponent />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(screen.getByText('Clicked')).toBeInTheDocument();
  });
});
```

### E2E Tests

Place E2E tests in `tests/e2e/` with the `.spec.ts` extension.

#### Example: Testing a page

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should allow user to login', async ({ page }) => {
    await page.goto('/auth/signin');
    
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/');
  });
});
```

#### Example: Testing API endpoints

```typescript
import { test, expect } from '@playwright/test';

test('API health check', async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBeTruthy();
  
  const data = await response.json();
  expect(data).toHaveProperty('status', 'ok');
});
```

## Best Practices

### Unit Tests

1. **Use descriptive test names** - Test names should clearly describe what is being tested
2. **Follow AAA pattern** - Arrange, Act, Assert
3. **Test behavior, not implementation** - Focus on what the component does, not how it does it
4. **Use Testing Library queries** - Prefer `getByRole` over `getByTestId`
5. **Mock external dependencies** - Use `vi.mock()` for modules and `vi.fn()` for functions
6. **Use inline snapshots** - For complex output validation with `toMatchInlineSnapshot()`

### E2E Tests

1. **Use Page Object Model** - Organize page interactions into reusable classes
2. **Use resilient locators** - Prefer role-based selectors over CSS selectors
3. **Handle async operations** - Use `waitFor` methods appropriately
4. **Isolate tests** - Each test should be independent
5. **Use browser contexts** - For isolating test environments
6. **Visual testing** - Use `toHaveScreenshot()` for visual regression testing

## Mocking APIs with MSW

MSW is configured in `tests/setup/msw.setup.ts`. To mock an API endpoint:

```typescript
import { http, HttpResponse } from 'msw';
import { server } from '../setup/msw.setup';

// In your test file
server.use(
  http.get('/api/recipes', () => {
    return HttpResponse.json([
      { id: 1, name: 'Recipe 1' },
      { id: 2, name: 'Recipe 2' },
    ]);
  })
);
```

## Coverage

Coverage reports are generated in the `coverage/` directory when running `npm run test:unit:coverage`.

Target coverage thresholds:
- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

Focus on meaningful tests rather than arbitrary coverage percentages.

## Debugging

### Vitest

- Use `--watch` mode for instant feedback
- Use `--ui` mode for visual debugging
- Use `console.log()` or debugger statements
- Run specific tests with `-t "test name"`

### Playwright

- Use `--debug` flag to run tests in debug mode
- Use `--headed` to see the browser
- Use trace viewer for debugging failures: `npx playwright show-trace trace.zip`
- Use `page.pause()` to pause execution

## CI/CD Integration

Tests are configured to run in CI/CD pipelines:

- Unit tests run on every commit
- E2E tests run on every pull request
- Coverage reports are generated and uploaded

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)

