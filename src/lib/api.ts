import type { StandardResponse } from "@/types";

const extractMessageFromPayload = (payload: Record<string, unknown> | null): string | null => {
  if (!payload) {
    return null;
  }

  const candidates = [payload.error, payload.message, payload.detail, payload.description];
  const match = candidates.find(
    (candidate): candidate is string => typeof candidate === "string" && candidate.length > 0
  );

  return match ?? null;
};

export const parseApiError = async (response: Response): Promise<string> => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as Record<string, unknown> | null;
      const derivedMessage = extractMessageFromPayload(payload);

      if (derivedMessage) {
        return derivedMessage;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("Failed to parse API error response", error);
      }
    }
  } else {
    try {
      const text = await response.text();

      if (text.trim().length > 0) {
        return text;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.debug("Failed to read API error body", error);
      }
    }
  }

  if (response.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (response.status === 404) {
    return "The requested resource could not be found.";
  }

  return response.statusText || "Request failed.";
};

export const readStandardApiResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json()) as StandardResponse<T> | null;

  if (!payload || typeof payload !== "object" || payload.data === undefined) {
    throw new Error("Malformed response payload.");
  }

  return payload.data;
};
