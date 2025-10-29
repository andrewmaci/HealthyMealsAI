import { useCallback, useEffect, useState } from "react";

import { parseApiError, readStandardApiResponse } from "@/lib/api";
import type { AdaptationQuotaDTO } from "@/types";

interface UseQuotaResult {
  quota: AdaptationQuotaDTO | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useQuota = (): UseQuotaResult => {
  const [quota, setQuota] = useState<AdaptationQuotaDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/adaptations/quota", {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const message = await parseApiError(response);
        setError(message);
        setLoading(false);
        return;
      }

      const data = await readStandardApiResponse<AdaptationQuotaDTO>(response);
      setQuota(data);
      setLoading(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Failed to load adaptation quota.";
      setError(message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  return {
    quota,
    loading,
    error,
    refresh,
  };
};
