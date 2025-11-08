import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RecipeListResponseDTO } from "@/types";

import type {
  ApiError,
  FilterFormValues,
  RecipeListItemVM,
  RecipeListQueryState,
  RecipeSortBy,
  SortOrder,
} from "./types";

const RecipeSortableColumns: readonly RecipeSortBy[] = ["created_at", "updated_at", "title"] as const;
const SortOrders: readonly SortOrder[] = ["asc", "desc"] as const;
const isBrowser = typeof window !== "undefined";

export const DEFAULT_QUERY: RecipeListQueryState = {
  page: 1,
  pageSize: 10,
  sortBy: "updated_at",
  sortOrder: "desc",
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isSortBy = (value: string | null): value is RecipeSortBy =>
  Boolean(value) && (RecipeSortableColumns as readonly string[]).includes(value);

const isSortOrder = (value: string | null): value is SortOrder =>
  Boolean(value) && (SortOrders as readonly string[]).includes(value);

const coerceInt = (value: unknown): number | undefined => {
  if (value == null) {
    return undefined;
  }

  const coerced = Number(value);

  if (!Number.isFinite(coerced) || !Number.isInteger(coerced)) {
    return undefined;
  }

  return coerced;
};

const coerceNumber = (value: unknown): number | undefined => {
  if (value == null) {
    return undefined;
  }

  const coerced = Number(value);

  if (!Number.isFinite(coerced)) {
    return undefined;
  }

  return coerced;
};

const sanitizeFilters = (values: FilterFormValues): FilterFormValues => {
  const result: FilterFormValues = {};

  const normalize = (input: number | undefined) => {
    if (input === undefined) {
      return undefined;
    }

    if (Number.isNaN(input)) {
      return undefined;
    }

    if (input < 0) {
      return 0;
    }

    return Math.round(input * 100) / 100;
  };

  const minKcal = normalize(values.minKcal);
  const maxKcal = normalize(values.maxKcal);
  const minProtein = normalize(values.minProtein);
  const maxProtein = normalize(values.maxProtein);

  if (minKcal !== undefined) {
    result.minKcal = minKcal;
  }

  if (maxKcal !== undefined) {
    result.maxKcal = maxKcal;
  }

  if (minProtein !== undefined) {
    result.minProtein = minProtein;
  }

  if (maxProtein !== undefined) {
    result.maxProtein = maxProtein;
  }

  if (result.minKcal !== undefined && result.maxKcal !== undefined && result.minKcal > result.maxKcal) {
    result.maxKcal = result.minKcal;
  }

  if (result.minProtein !== undefined && result.maxProtein !== undefined && result.minProtein > result.maxProtein) {
    result.maxProtein = result.minProtein;
  }

  return result;
};

export const parseQueryFromSearchParams = (searchParams: URLSearchParams): RecipeListQueryState => {
  const page = clamp(coerceInt(searchParams.get("page")) ?? DEFAULT_QUERY.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clamp(coerceInt(searchParams.get("pageSize")) ?? DEFAULT_QUERY.pageSize, 1, 50);
  const sortByParam = searchParams.get("sortBy");
  const sortBy = isSortBy(sortByParam) ? sortByParam : DEFAULT_QUERY.sortBy;
  const sortOrderParam = searchParams.get("sortOrder");
  const sortOrder = isSortOrder(sortOrderParam) ? sortOrderParam : DEFAULT_QUERY.sortOrder;
  const search = searchParams.get("search")?.trim() ?? undefined;
  const minKcal = coerceNumber(searchParams.get("minKcal"));
  const maxKcal = coerceNumber(searchParams.get("maxKcal"));
  const minProtein = coerceNumber(searchParams.get("minProtein"));
  const maxProtein = coerceNumber(searchParams.get("maxProtein"));

  const filters = sanitizeFilters({ minKcal, maxKcal, minProtein, maxProtein });

  return normalizeQuery({
    page,
    pageSize,
    sortBy,
    sortOrder,
    search: search?.length ? search : undefined,
    ...filters,
  });
};

export const mapQueryToSearchParams = (query: RecipeListQueryState) => {
  const params = new URLSearchParams();

  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  params.set("sortBy", query.sortBy);
  params.set("sortOrder", query.sortOrder);

  if (query.search) {
    params.set("search", query.search);
  }

  const setFilter = (key: keyof FilterFormValues) => {
    const value = query[key];
    if (value !== undefined) {
      params.set(key, String(value));
    }
  };

  setFilter("minKcal");
  setFilter("maxKcal");
  setFilter("minProtein");
  setFilter("maxProtein");

  return params;
};

const areQueriesEqual = (left: RecipeListQueryState, right: RecipeListQueryState) =>
  left.page === right.page &&
  left.pageSize === right.pageSize &&
  left.search === right.search &&
  left.sortBy === right.sortBy &&
  left.sortOrder === right.sortOrder &&
  left.minKcal === right.minKcal &&
  left.maxKcal === right.maxKcal &&
  left.minProtein === right.minProtein &&
  left.maxProtein === right.maxProtein;

const normalizeQuery = (input: RecipeListQueryState): RecipeListQueryState => {
  const filters = sanitizeFilters({
    minKcal: input.minKcal,
    maxKcal: input.maxKcal,
    minProtein: input.minProtein,
    maxProtein: input.maxProtein,
  });

  const normalized = {
    ...input,
    ...filters,
    page: Math.max(1, Math.floor(input.page || DEFAULT_QUERY.page)),
    pageSize: clamp(Math.floor(input.pageSize || DEFAULT_QUERY.pageSize), 1, 50),
    sortBy: RecipeSortableColumns.includes(input.sortBy) ? input.sortBy : DEFAULT_QUERY.sortBy,
    sortOrder: SortOrders.includes(input.sortOrder) ? input.sortOrder : DEFAULT_QUERY.sortOrder,
  } satisfies RecipeListQueryState;

  normalized.search = input.search?.trim() || undefined;

  return normalized;
};

export const useDebouncedValue = <T>(value: T, delay: number) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delay);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [value, delay]);

  return debounced;
};

interface UseQueryStateSyncResult {
  query: RecipeListQueryState;
  setQuery: (updater: (current: RecipeListQueryState) => RecipeListQueryState) => void;
}

export const useQueryStateSync = (): UseQueryStateSyncResult => {
  const [query, setQueryState] = useState<RecipeListQueryState>(() => {
    if (!isBrowser) {
      return { ...DEFAULT_QUERY };
    }

    return parseQueryFromSearchParams(new URLSearchParams(window.location.search));
  });

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const handler = () => {
      setQueryState(parseQueryFromSearchParams(new URLSearchParams(window.location.search)));
    };

    window.addEventListener("popstate", handler);

    return () => window.removeEventListener("popstate", handler);
  }, []);

  const setQuery = useCallback((updater: (current: RecipeListQueryState) => RecipeListQueryState) => {
    setQueryState((current) => {
      const next = normalizeQuery(updater(current));
      if (isBrowser) {
        const params = mapQueryToSearchParams(next);
        const nextUrl = `${window.location.pathname}?${params.toString()}`;

        if (!areQueriesEqual(current, next)) {
          const shouldPush = next.page !== current.page;
          const method = shouldPush ? "pushState" : "replaceState";
          window.history[method](null, "", nextUrl);
        }
      }

      return next;
    });
  }, []);

  return { query, setQuery };
};

interface UseRecipesResult {
  data?: RecipeListResponseDTO;
  items: RecipeListItemVM[];
  isLoading: boolean;
  error?: ApiError;
  refetch: () => void;
}

const mapRecipeDtoToVM = (dto: RecipeListResponseDTO["data"][number]): RecipeListItemVM => ({
  id: dto.id,
  title: dto.title,
  servings: dto.servings,
  macros: dto.macros,
  updatedAtIso: dto.updatedAt,
  updatedAtRelative: new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round((new Date(dto.updatedAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day"
  ),
});

export const useRecipes = (query: RecipeListQueryState): UseRecipesResult => {
  const [data, setData] = useState<RecipeListResponseDTO>();
  const [items, setItems] = useState<RecipeListItemVM[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError>();
  const abortRef = useRef<AbortController>();
  const queryRef = useRef<RecipeListQueryState>(query);

  const fetchData = useCallback(async (activeQuery: RecipeListQueryState) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);
    setError(undefined);

    const params = mapQueryToSearchParams(activeQuery);

    try {
      const response = await fetch(`/api/recipes?${params.toString()}`, {
        credentials: "same-origin",
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 400) {
          const body = (await response.json()) as { error?: string };
          setError({ status: 400, message: body.error ?? "Validation error" });
          return;
        }

        if (response.status === 401) {
          setError({ status: 401, message: "You need to sign in to view recipes." });
          return;
        }

        throw new Error(`Request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as RecipeListResponseDTO;

      setData(payload);
      setItems(payload.data.map(mapRecipeDtoToVM));
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }

      console.error("Failed to load recipes", err);
      setError({ status: 500, message: "We couldn't load your recipes. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (areQueriesEqual(queryRef.current, query)) {
      return;
    }

    queryRef.current = query;
    void fetchData(query);
  }, [fetchData, query]);

  useEffect(() => {
    queryRef.current = query;
    void fetchData(query);

    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const refetch = useCallback(() => {
    void fetchData(queryRef.current);
  }, [fetchData]);

  const stableItems = useMemo(() => items, [items]);

  return {
    data,
    items: stableItems,
    isLoading,
    error,
    refetch,
  };
};
