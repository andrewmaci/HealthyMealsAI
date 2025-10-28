import { useCallback, useMemo, useRef, useState } from "react";

import type { ProfileDTO, ProfileUpdateDto } from "@/types";

import type { UseSaveProfileOptions, UseSaveProfileResult } from "./types";

const isValidationError = (
  error: unknown,
): error is { details?: unknown; error?: string } => {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "details" in error;
};

export function useSaveProfile(options: UseSaveProfileOptions): UseSaveProfileResult {
  const [saving, setSaving] = useState(false);
  const lastModifiedRef = useRef(options.lastModified);

  const safeSetLastModified = useCallback((value: string | null) => {
    lastModifiedRef.current = value;
  }, []);

  const save = useCallback(
    async (values: ProfileUpdateDto) => {
      if (!lastModifiedRef.current) {
        console.warn("Attempted to save profile without a lastModified token.");
        return;
      }

      setSaving(true);

      try {
        const response = await fetch("/api/profile", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "if-unmodified-since": lastModifiedRef.current,
            "accept": "application/json",
          },
          body: JSON.stringify(values),
        });

        if (response.status === 401) {
          options.onUnauthorized?.();
          return;
        }

        if (response.status === 409) {
          options.onConflict?.();
          return;
        }

        if (response.status === 400) {
          const body = await response.json().catch(() => undefined);
          if (isValidationError(body)) {
            const flattened = typeof body.details === "string" ? body.details : undefined;
            options.onValidation?.(flattened ?? body.error ?? "Validation failed");
            return;
          }

          options.onValidation?.("Validation failed");
          return;
        }

        if (!response.ok) {
          const body = await response.json().catch(() => undefined);
          const message = body?.error ?? response.statusText;
          if (response.status >= 500) {
            options.onServer?.(message);
          } else {
            options.onNetwork?.(message);
          }
          return;
        }

        const nextLastModified = response.headers.get("last-modified") ?? response.headers.get("Last-Modified");
        const payload = (await response.json()) as { data: ProfileDTO };
        const fallbackLastModified = new Date(payload.data.updatedAt).toUTCString();

        safeSetLastModified(nextLastModified ?? fallbackLastModified);
        options.onSuccess?.(payload.data, nextLastModified ?? fallbackLastModified);
      } catch (error) {
        if (error instanceof TypeError) {
          options.onNetwork?.(error.message);
          return;
        }

        options.onServer?.(error instanceof Error ? error.message : undefined);
      } finally {
        setSaving(false);
      }
    },
    [options, safeSetLastModified],
  );

  return useMemo(() => ({
    save,
    saving,
  }), [save, saving]);
}

