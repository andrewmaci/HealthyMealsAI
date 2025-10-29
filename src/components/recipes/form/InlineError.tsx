interface InlineErrorProps {
  id?: string;
  message?: string;
}

export function InlineError({ id, message }: InlineErrorProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

