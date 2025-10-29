import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import type { AdaptationQuotaDTO } from "@/types";

interface AdaptationToolbarProps {
  quota: AdaptationQuotaDTO | null;
  quotaError: string | null;
  onOpenWizard: () => void;
  isLoading: boolean;
}

const formatResetTime = (windowEnd: string | undefined, timezone: string | undefined) => {
  if (!windowEnd) {
    return null;
  }

  try {
    const date = new Date(windowEnd);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
      timeZone: timezone ?? "UTC",
    }).format(date);
  } catch (_error) {
    return null;
  }
};

const AdaptationToolbar = ({ quota, quotaError, onOpenWizard, isLoading }: AdaptationToolbarProps) => {
  const remaining = quota?.remaining ?? null;
  const limit = quota?.limit ?? null;
  const timezone = quota?.timezone ?? "UTC";
  const resetTime = useMemo(() => formatResetTime(quota?.windowEnd, timezone), [quota?.windowEnd, timezone]);

  const isQuotaKnown = typeof remaining === "number" && typeof limit === "number";
  const isQuotaExhausted = isQuotaKnown && remaining <= 0;
  const isButtonDisabled = isLoading || isQuotaExhausted;

  const handleClick = () => {
    if (isButtonDisabled) {
      return;
    }

    onOpenWizard();
  };

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Adapt with AI</h2>
          <p className="text-sm text-muted-foreground">
            Customize this recipe using your preferences. Remaining quota updates daily.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleClick} disabled={isButtonDisabled} variant={isQuotaExhausted ? "outline" : "default"}>
            {isButtonDisabled && !isQuotaExhausted ? "Loading..." : "Adapt with AI"}
          </Button>
          {isQuotaKnown ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {remaining} of {limit} remaining
            </span>
          ) : null}
        </div>
      </div>
      {quotaError ? (
        <p className="flex items-start gap-2 text-xs text-amber-900">
          <span aria-hidden="true">⚠️</span>
          <span>{quotaError}</span>
        </p>
      ) : null}
      {isQuotaExhausted && resetTime ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <span aria-hidden="true">ℹ️</span>
          <span>
            Daily limit reached. Quota resets at <strong>{resetTime}</strong> ({timezone}).
          </span>
        </p>
      ) : null}
    </section>
  );
};

export default AdaptationToolbar;


