import { useCallback, useEffect, useRef, useState } from "react";

import { parseApiError, readStandardApiResponse } from "@/lib/api";
import type { RecipeDTO } from "@/types";

type DeleteRecipeResult = "deleted" | "not-found";

interface UseRecipeDetailResult {
  recipe: RecipeDTO | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  refresh: () => Promise<void>;
  setRecipe: (next: RecipeDTO) => void;
  deleteRecipe: () => Promise<DeleteRecipeResult>;
}

export const useRecipeDetail = (id: string | null): UseRecipeDetailResult => {
  const [recipe, setRecipeState] = useState<RecipeDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(id));
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) {
      setRecipeState(null);
      setLoading(false);
      setNotFound(true);
      return;
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const message = await parseApiError(response);

        if (!mountedRef.current) {
          return;
        }

        if (response.status === 404) {
          setNotFound(true);
          setRecipeState(null);
        } else {
          setError(message);
        }

        setLoading(false);
        return;
      }

      const data = await readStandardApiResponse<RecipeDTO>(response);

      if (!mountedRef.current) {
        return;
      }

      setRecipeState(data);
      setLoading(false);
      setNotFound(false);
    } catch (caughtError) {
      if (!mountedRef.current || controller.signal.aborted) {
        return;
      }

      const message = caughtError instanceof Error ? caughtError.message : "Failed to load recipe.";
      setError(message);
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    await load();
  }, [load]);

  const deleteRecipe = useCallback(async (): Promise<DeleteRecipeResult> => {
    if (!id) {
      throw new Error("Missing recipe identifier.");
    }

    const response = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 204) {
      setRecipeState(null);
      setNotFound(true);
      return "deleted";
    }

    if (!response.ok) {
      const message = await parseApiError(response);

      if (response.status === 404) {
        setRecipeState(null);
        setNotFound(true);
        return "not-found";
      }

      throw new Error(message);
    }

    setRecipeState(null);
    setNotFound(true);
    return "deleted";
  }, [id]);

  const setRecipe = useCallback((next: RecipeDTO) => {
    setRecipeState(next);
    setNotFound(false);
    setError(null);
  }, []);

  return {
    recipe,
    loading,
    error,
    notFound,
    refresh,
    setRecipe,
    deleteRecipe,
  };
};
