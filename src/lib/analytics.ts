type AnalyticsEvent = "ai_requested" | "ai_succeeded" | "ai_accepted";

interface AnalyticsPayload {
  event: AnalyticsEvent;
  timestampUtc: string;
  timezone: string;
  metadata?: Record<string, unknown>;
}

const emitAnalyticsPayload = (payload: AnalyticsPayload) => {
  if (import.meta.env.DEV) {
    console.info("[analytics]", payload);
    return;
  }

  // Placeholder: replace with real analytics transport when available.
  console.log("[analytics]", payload);
};

const createPayload = (
  event: AnalyticsEvent,
  timezone: string,
  metadata?: Record<string, unknown>
): AnalyticsPayload => ({
  event,
  timestampUtc: new Date().toISOString(),
  timezone,
  metadata,
});

export const trackAiRequested = (timezone: string, metadata?: Record<string, unknown>) => {
  emitAnalyticsPayload(createPayload("ai_requested", timezone, metadata));
};

export const trackAiSucceeded = (timezone: string, metadata?: Record<string, unknown>) => {
  emitAnalyticsPayload(createPayload("ai_succeeded", timezone, metadata));
};

export const trackAiAccepted = (timezone: string, metadata?: Record<string, unknown>) => {
  emitAnalyticsPayload(createPayload("ai_accepted", timezone, metadata));
};
