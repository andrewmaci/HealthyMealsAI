import type { SupabaseClient } from "../../db/supabase.client";
import type {
  GetRecipeAdaptationHistoryQuery,
  RecipeAdaptationHistoryItemDTO,
  RecipeAdaptationHistoryResponseDTO,
} from "../../types";

type AdaptationServiceErrorCode = "recipe_not_found" | "history_fetch_failed" | "history_count_failed";

interface AdaptationServiceErrorOptions {
  code: AdaptationServiceErrorCode;
  message: string;
  cause?: unknown;
}

export class AdaptationServiceError extends Error {
  public readonly code: AdaptationServiceErrorCode;

  public constructor(options: AdaptationServiceErrorOptions) {
    super(options.message);
    this.name = "AdaptationServiceError";
    this.code = options.code;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

const mapHistoryRowToDTO = (row: {
  id: string;
  recipe_id: string | null;
  created_at: string;
}): RecipeAdaptationHistoryItemDTO => ({
  id: row.id,
  recipeId: row.recipe_id,
  createdAt: row.created_at,
});

const applyHistoryFilters = (
  builder: ReturnType<SupabaseClient["from"]>,
  query: GetRecipeAdaptationHistoryQuery,
) => {
  let chained = builder;

  if (query.start) {
    chained = chained.gte("created_at", query.start);
  }

  if (query.end) {
    chained = chained.lte("created_at", query.end);
  }

  return chained;
};

export const getAdaptationHistory = async (
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  query: GetRecipeAdaptationHistoryQuery,
): Promise<RecipeAdaptationHistoryResponseDTO> => {
  const { count: recipeCount, error: recipeError } = await supabase
    .from("recipes")
    .select("id", { count: "exact", head: true })
    .eq("id", recipeId)
    .eq("user_id", userId)
    .maybeSingle();

  if (recipeError) {
    console.error("Failed to verify recipe ownership", {
      userId,
      recipeId,
      error: recipeError,
    });

    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to verify recipe ownership.",
      cause: recipeError,
    });
  }

  if ((recipeCount ?? 0) === 0) {
    throw new AdaptationServiceError({
      code: "recipe_not_found",
      message: "Recipe not found.",
    });
  }

  const rangeStart = (query.page - 1) * query.pageSize;
  const rangeEnd = rangeStart + query.pageSize - 1;

  const countPromise = applyHistoryFilters(
    supabase
      .from("adaptation_logs")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .eq("recipe_id", recipeId),
    query,
  ).maybeSingle();

  const dataPromise = applyHistoryFilters(
    supabase
      .from("adaptation_logs")
      .select("id, recipe_id, created_at")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId),
    query,
  )
    .order("created_at", { ascending: query.sortOrder === "asc" })
    .range(rangeStart, rangeEnd);

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countPromise, dataPromise]);

  if (countError) {
    console.error("Failed to count adaptation history", {
      userId,
      recipeId,
      query,
      error: countError,
    });

    throw new AdaptationServiceError({
      code: "history_count_failed",
      message: "Unable to count adaptation history records.",
      cause: countError,
    });
  }

  if (dataError) {
    console.error("Failed to fetch adaptation history", {
      userId,
      recipeId,
      query,
      error: dataError,
    });

    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to fetch adaptation history.",
      cause: dataError,
    });
  }

  const totalItems = count ?? data?.length ?? 0;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    data: (data ?? []).map(mapHistoryRowToDTO),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  } satisfies RecipeAdaptationHistoryResponseDTO;
};

