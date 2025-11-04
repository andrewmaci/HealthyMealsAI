import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

/**
 * Custom render helpers for React components
 * Add providers and wrappers here as needed
 */

/**
 * Custom render function that wraps components with common providers
 * Extend this as you add more global providers (e.g., theme, router, etc.)
 */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  // Example wrapper with providers
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    // Add your providers here
    // Example: <ThemeProvider><RouterProvider>{children}</RouterProvider></ThemeProvider>
    return <>{children}</>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Re-export everything from Testing Library
 */
export * from '@testing-library/react';
export { renderWithProviders as render };

