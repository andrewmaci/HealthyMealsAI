import type { Tables } from "../../db/database.types";
import type { SupabaseClient } from "../../db/supabase.client";
import type {
  GetRecipeAdaptationHistoryQuery,
  RecipeAdaptationAcceptCommand,
  RecipeAdaptationHistoryItemDTO,
  RecipeAdaptationHistoryResponseDTO,
  RecipeDTO,
} from "../../types";

type AdaptationServiceErrorCode =
  | "recipe_not_found"
  | "history_fetch_failed"
  | "history_count_failed"
  | "proposal_not_found"
  | "accept_failed";

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

type RecipeRow = Tables<"recipes">;

const mapRecipeRowToDTO = (row: RecipeRow): RecipeDTO => ({
  id: row.id,
  title: row.title,
  servings: row.servings,
  macros: {
    kcal: row.kcal,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  },
  recipeText: row.recipe_text,
  lastAdaptationExplanation: row.last_adaptation_explanation,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const acceptAdaptation = async (
  supabase: SupabaseClient,
  userId: string,
  recipeId: string,
  command: RecipeAdaptationAcceptCommand,
): Promise<RecipeDTO> => {
  const { data: ownershipRow, error: ownershipError } = await supabase
    .from("adaptation_logs")
    .select("id, recipe_id, user_id, recipes!inner(id, user_id)")
    .eq("id", command.logId)
    .eq("recipe_id", recipeId)
    .eq("user_id", userId)
    .eq("recipes.user_id", userId)
    .maybeSingle();

  if (ownershipError) {
    console.error("Failed to verify adaptation proposal ownership", {
      userId,
      recipeId,
      command,
      error: ownershipError,
    });

    throw new AdaptationServiceError({
      code: "history_fetch_failed",
      message: "Unable to verify adaptation proposal ownership.",
      cause: ownershipError,
    });
  }

  if (!ownershipRow || !ownershipRow.recipes || ownershipRow.recipes.user_id !== userId) {
    console.warn("Adaptation proposal not found or unauthorized", {
      userId,
      recipeId,
      command,
      ownershipRow,
    });

    throw new AdaptationServiceError({
      code: "proposal_not_found",
      message: "Adaptation proposal not found.",
    });
  }

  const { data: recipeRow, error: updateError } = await supabase
    .from("recipes")
    .update({
      recipe_text: command.recipeText,
      kcal: command.macros.kcal,
      protein: command.macros.protein,
      carbs: command.macros.carbs,
      fat: command.macros.fat,
      last_adaptation_explanation: command.explanation,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recipeId)
    .eq("user_id", userId)
    .select("id, title, servings, kcal, protein, carbs, fat, recipe_text, last_adaptation_explanation, created_at, updated_at")
    .maybeSingle();

  if (updateError || !recipeRow) {
    console.error("Failed to accept adaptation", {
      userId,
      recipeId,
      command,
      error: updateError,
    });

    throw new AdaptationServiceError({
      code: "accept_failed",
      message: "Unable to accept adaptation.",
      cause: updateError,
    });
  }

  return mapRecipeRowToDTO(recipeRow as RecipeRow);
};

