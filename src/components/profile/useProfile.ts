import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ProfileDTO, ProfileResponseDTO } from "@/types";

import type { UseProfileResult } from "./types";

type Status = UseProfileResult["status"];

interface FetchState {
  status: Status;
  data: ProfileDTO | null;
  lastModified: string | null;
  error: unknown | null;
}

const INITIAL_STATE: FetchState = {
  status: "idle",
  data: null,
  lastModified: null,
  error: null,
};

const isProfileResponse = (value: unknown): value is ProfileResponseDTO => {
  if (!value || typeof value !== "object") {
    return false;
  }

  return "data" in value;
};

const pickLastModified = (response: Response): string | null => {
  const header = response.headers.get("last-modified") ?? response.headers.get("Last-Modified");
  if (header) {
    return header;
  }

  return null;
};

export function useProfile(): UseProfileResult {
  const [state, setState] = useState<FetchState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const fetchProfile = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((prev) => ({ ...prev, status: "loading", error: null }));

    try {
      const response = await fetch("/api/profile", {
        method: "GET",
        headers: {
          accept: "application/json",
        },
        signal: controller.signal,
      });

      if (response.status === 401) {
        setState({
          status: "unauthorized",
          data: null,
          lastModified: null,
          error: null,
        });
        return;
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => undefined);
        const message = errorBody?.error ?? response.statusText;
        setState({
          status: "error",
          data: null,
          lastModified: null,
          error: new Error(message),
        });
        return;
      }

      const body = await response.json();
      if (!isProfileResponse(body)) {
        throw new Error("Malformed profile response");
      }

      const lastModified = pickLastModified(response);

      if (!lastModified) {
        console.warn("Missing Last-Modified header. Falling back to updatedAt.");
      }

      const fallback = new Date(body.data.updatedAt).toUTCString();

      setState({
        status: "success",
        data: body.data,
        lastModified: lastModified ?? fallback,
        error: null,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setState({
        status: "error",
        data: null,
        lastModified: null,
        error,
      });
    }
  }, []);

  const refetch = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchProfile();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchProfile]);

  return useMemo(
    () => ({
      status: state.status,
      data: state.data,
      lastModified: state.lastModified,
      error: state.error,
      refetch,
    }),
    [refetch, state.data, state.error, state.lastModified, state.status]
  );
}
