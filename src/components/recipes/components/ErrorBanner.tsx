import { Button } from "@/components/ui/button";

import type { ApiError } from "../types";

type ErrorBannerProps = {
  error?: ApiError;
  onRetry: () => void;
};

const ErrorBanner = ({ error, onRetry }: ErrorBannerProps) => {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="font-semibold">{error.message}</p>
          {error.status === 401 ? (
            <p className="text-xs text-muted-foreground">
              You may need to <a href="/login" className="underline">sign in</a> again.
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
};

export default ErrorBanner;

