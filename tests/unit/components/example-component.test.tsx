import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

/**
 * Example React component test using React Testing Library
 * Demonstrates component testing best practices
 */

// Example component to test
function ExampleButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} type="button">
      {children}
    </button>
  );
}

describe('ExampleButton', () => {
  it('should render button with text', () => {
    render(<ExampleButton onClick={() => {}}>Click me</ExampleButton>);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<ExampleButton onClick={handleClick}>Click me</ExampleButton>);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(handleClick).toHaveBeenCalledOnce();
  });
});

