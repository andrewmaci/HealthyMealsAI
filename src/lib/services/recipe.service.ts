import type { SupabaseClient } from "../../db/supabase.client";
import type { Tables, TablesUpdate } from "../../db/database.types";
import type {
  GetRecipesQuery,
  RecipeCreateCommand,
  RecipeDTO,
  RecipeListResponseDTO,
  RecipeUpdateCommand,
} from "../../types";
import type { TablesInsert } from "../../db/database.types";

type RecipeRow = Tables<"recipes">;

type RecipeServiceErrorCode =
  | "fetch_failed"
  | "count_failed"
  | "insert_failed"
  | "update_failed"
  | "delete_failed";

interface RecipeServiceErrorOptions {
  message: string;
  code: RecipeServiceErrorCode;
  cause?: unknown;
}

export class RecipeServiceError extends Error {
  public readonly code: RecipeServiceErrorCode;

  public constructor(options: RecipeServiceErrorOptions) {
    super(options.message);
    this.name = "RecipeServiceError";
    this.code = options.code;
    if (options.cause) {
      this.cause = options.cause;
    }
  }
}

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

export const createRecipe = async (
  supabase: SupabaseClient,
  userId: string,
  command: RecipeCreateCommand,
): Promise<RecipeDTO> => {
  const insertPayload = {
    title: command.title,
    servings: command.servings,
    kcal: command.macros.kcal,
    protein: command.macros.protein,
    carbs: command.macros.carbs,
    fat: command.macros.fat,
    recipe_text: command.recipeText,
    last_adaptation_explanation: command.lastAdaptationExplanation ?? null,
    user_id: userId,
  } satisfies TablesInsert<"recipes">;

  const { data, error } = await supabase
    .from("recipes")
    .insert(insertPayload)
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to insert recipe", {
      userId,
      command,
      error,
    });

    throw new RecipeServiceError({
      message: "Unable to create recipe",
      code: "insert_failed",
      cause: error,
    });
  }

  return mapRecipeRowToDTO(data);
};

const mapSortColumn = (column: GetRecipesQuery["sortBy"]): keyof RecipeRow => {
  switch (column) {
    case "title":
      return "title";
    case "created_at":
      return "created_at";
    case "updated_at":
    default:
      return "updated_at";
  }
};

const applyFilters = (builder: ReturnType<SupabaseClient["from"]>, query: GetRecipesQuery, userId: string) => {
  let chained = builder.eq("user_id", userId);

  if (query.search) {
    const pattern = `%${query.search}%`;
    chained = chained.or(
      `title.ilike.${pattern},recipe_text.ilike.${pattern}`,
      { foreignTable: undefined },
    );
  }

  if (query.minKcal !== undefined) {
    chained = chained.gte("kcal", query.minKcal);
  }

  if (query.maxKcal !== undefined) {
    chained = chained.lte("kcal", query.maxKcal);
  }

  if (query.minProtein !== undefined) {
    chained = chained.gte("protein", query.minProtein);
  }

  if (query.maxProtein !== undefined) {
    chained = chained.lte("protein", query.maxProtein);
  }

  return chained;
};

export const getRecipes = async (
  supabase: SupabaseClient,
  userId: string,
  query: GetRecipesQuery,
): Promise<RecipeListResponseDTO> => {
  const sortColumn = mapSortColumn(query.sortBy);
  const isAscending = query.sortOrder === "asc";
  const rangeStart = (query.page - 1) * query.pageSize;
  const rangeEnd = rangeStart + query.pageSize - 1;

  const baseBuilder = supabase.from("recipes");

  const countPromise = applyFilters(
    baseBuilder.select("id", { count: "exact", head: true }),
    query,
    userId,
  ).maybeSingle();

  const dataPromise = applyFilters(
    baseBuilder
      .select("*")
      .order(sortColumn, { ascending: isAscending })
      .range(rangeStart, rangeEnd),
    query,
    userId,
  );

  const [{ count, error: countError }, { data, error: dataError }] = await Promise.all([countPromise, dataPromise]);

  if (countError) {
    console.error("Failed to retrieve recipe count", {
      userId,
      query,
      error: countError,
    });
    throw new RecipeServiceError({
      message: "Unable to count recipes",
      code: "count_failed",
      cause: countError,
    });
  }

  if (dataError) {
    console.error("Failed to retrieve recipe list", {
      userId,
      query,
      error: dataError,
    });
    throw new RecipeServiceError({
      message: "Unable to fetch recipes",
      code: "fetch_failed",
      cause: dataError,
    });
  }

  const safeCount = count ?? data?.length ?? 0;
  const resolvedData = data ?? [];

  const totalPages = safeCount === 0 ? 0 : Math.ceil(safeCount / query.pageSize);

  return {
    data: resolvedData.map(mapRecipeRowToDTO),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: safeCount,
      totalPages,
    },
  };
};

export const getRecipeById = async (
  supabase: SupabaseClient,
  id: string,
  userId: string,
): Promise<RecipeDTO | null> => {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to retrieve recipe", {
      userId,
      id,
      error,
    });

    throw new RecipeServiceError({
      message: "Unable to fetch recipe",
      code: "fetch_failed",
      cause: error,
    });
  }

  if (!data) {
    return null;
  }

  return mapRecipeRowToDTO(data);
};

export interface UpdateRecipeOptions {
  returnMode: "full" | "minimal";
}

interface UpdateRecipeResultBase {
  id: RecipeRow["id"];
  updatedAt: RecipeRow["updated_at"];
}

type UpdateRecipeResult =
  | (UpdateRecipeResultBase & { returnMode: "minimal" })
  | (UpdateRecipeResultBase & { returnMode: "full"; recipe: RecipeDTO });

const buildUpdatePayload = (command: RecipeUpdateCommand) => {
  const payload: Partial<TablesUpdate<"recipes">> = {};

  if (command.title !== undefined) {
    payload.title = command.title;
  }

  if (command.servings !== undefined) {
    payload.servings = command.servings;
  }

  if (command.recipeText !== undefined) {
    payload.recipe_text = command.recipeText;
  }

  if (command.lastAdaptationExplanation !== undefined) {
    payload.last_adaptation_explanation = command.lastAdaptationExplanation ?? null;
  }

  if (command.macros) {
    payload.kcal = command.macros.kcal;
    payload.protein = command.macros.protein;
    payload.carbs = command.macros.carbs;
    payload.fat = command.macros.fat;
  }

  return payload;
};

export const updateRecipe = async (
  supabase: SupabaseClient,
  id: string,
  userId: string,
  command: RecipeUpdateCommand,
  options: UpdateRecipeOptions,
): Promise<UpdateRecipeResult | null> => {
  const payload = buildUpdatePayload(command);

  if (Object.keys(payload).length === 0) {
    throw new RecipeServiceError({
      message: "No fields provided for update",
      code: "update_failed",
    });
  }

  const { data, error } = await supabase
    .from("recipes")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();

  if (error) {
    console.error("Failed to update recipe", {
      userId,
      id,
      command,
      error,
    });

    throw new RecipeServiceError({
      message: "Unable to update recipe",
      code: "update_failed",
      cause: error,
    });
  }

  if (!data) {
    return null;
  }

  const base: UpdateRecipeResultBase = {
    id: data.id,
    updatedAt: data.updated_at,
  };

  if (options.returnMode === "minimal") {
    return {
      ...base,
      returnMode: "minimal",
    } satisfies UpdateRecipeResult;
  }

  return {
    ...base,
    returnMode: "full",
    recipe: mapRecipeRowToDTO(data),
  } satisfies UpdateRecipeResult;
};

export const deleteRecipe = async (supabase: SupabaseClient, id: string, userId: string): Promise<boolean> => {
  const { error, count } = await supabase
    .from("recipes")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete recipe", {
      userId,
      id,
      error,
    });

    throw new RecipeServiceError({
      message: "Unable to delete recipe",
      code: "delete_failed",
      cause: error,
    });
  }

  return (count ?? 0) > 0;
};

