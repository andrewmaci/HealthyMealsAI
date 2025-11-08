interface NotificationBoxProps {
  explanation: string | null;
  timezone: string;
  quotaError: string | null;
}

const NotificationBox = ({ explanation, timezone, quotaError }: NotificationBoxProps) => {
  if (!explanation && !quotaError) {
    return null;
  }

  return (
    <section className="space-y-2 text-sm text-muted-foreground">
      {explanation ? (
        <p className="flex items-start gap-2">
          <span aria-hidden="true" className="font-semibold text-foreground">
            [i]
          </span>
          <span className="whitespace-pre-wrap">
            <strong className="mr-1 font-semibold text-foreground">Last adaptation:</strong>
            {explanation}
          </span>
        </p>
      ) : null}
      {quotaError ? (
        <p className="flex items-start gap-2">
          <span aria-hidden="true" className="font-semibold text-destructive">
            [!]
          </span>
          <span>
            {quotaError} We will retry automatically. Local timezone: <strong>{timezone}</strong>.
          </span>
        </p>
      ) : null}
    </section>
  );
};

export default NotificationBox;
