import { describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "../../../../src/db/supabase.client";
import type { Tables } from "../../../../src/db/database.types";
import type { GetRecipesQuery } from "../../../../src/types";
import {
  RecipeServiceError,
  buildUpdatePayload,
  createRecipe,
  deleteRecipe,
  getRecipeById,
  getRecipes,
  mapRecipeRowToDTO,
  updateRecipe,
} from "../../../../src/lib/services/recipe.service";

const createRecipeRow = (overrides: Partial<Tables<"recipes">> = {}): Tables<"recipes"> => ({
  id: "recipe-123",
  title: "Grilled Salmon",
  servings: 4,
  kcal: 640,
  protein: 42,
  carbs: 18,
  fat: 22,
  recipe_text: "Season salmon and grill for 12 minutes, flipping once.",
  last_adaptation_explanation: "Reduced salt to suit dietary needs.",
  created_at: "2025-01-01T12:00:00.000Z",
  updated_at: "2025-01-02T08:30:00.000Z",
  user_id: "user-456",
  ...overrides,
});

type QueryFn = ReturnType<typeof vi.fn>;

interface SupabaseQueryBuilder<TResult> extends PromiseLike<TResult> {
  select: QueryFn;
  insert: QueryFn;
  update: QueryFn;
  delete: QueryFn;
  eq: QueryFn;
  or: QueryFn;
  gte: QueryFn;
  lte: QueryFn;
  order: QueryFn;
  range: QueryFn;
  single: QueryFn;
  maybeSingle: QueryFn;
}

type ChainableMethod = Exclude<keyof SupabaseQueryBuilder<unknown>, "single" | "maybeSingle" | "then">;

const chainableMethods = [
  "select",
  "insert",
  "update",
  "delete",
  "eq",
  "or",
  "gte",
  "lte",
  "order",
  "range",
] as const satisfies readonly ChainableMethod[];

const createQueryBuilder = <TResult>(result: TResult): SupabaseQueryBuilder<TResult> => {
  const builder = {} as SupabaseQueryBuilder<TResult>;

  chainableMethods.forEach((method) => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);
  builder.then = ((
    onfulfilled?: ((value: TResult) => TResult | PromiseLike<TResult>) | null,
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ) =>
    Promise.resolve(result).then(
      onfulfilled ?? undefined,
      onrejected ?? undefined
    )) as SupabaseQueryBuilder<TResult>["then"];

  return builder;
};

const createSupabaseClientMock = (
  builderFactory: (callIndex: number) => SupabaseQueryBuilder<unknown>
): {
  supabase: SupabaseClient;
  from: QueryFn;
  builders: SupabaseQueryBuilder<unknown>[];
} => {
  const builders: SupabaseQueryBuilder<unknown>[] = [];
  const from = vi.fn((table: string) => {
    if (table !== "recipes") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const builder = builderFactory(builders.length);
    builders.push(builder);
    return builder;
  });

  const supabase = { from } as unknown as SupabaseClient;

  return { supabase, from, builders };
};

const createGetRecipesQuery = (overrides: Partial<GetRecipesQuery> = {}): GetRecipesQuery => ({
  page: 1,
  pageSize: 10,
  sortBy: "updated_at",
  sortOrder: "desc",
  ...overrides,
});

const getBuilder = (builders: SupabaseQueryBuilder<unknown>[], index: number) => {
  const builder = builders[index];
  if (!builder) {
    throw new Error(`Supabase builder at index ${index} was not created`);
  }

  return builder;
};

describe("mapRecipeRowToDTO", () => {
  it("maps a complete recipe row to the DTO shape", () => {
    const row = createRecipeRow();

    const result = mapRecipeRowToDTO(row);

    expect(result).toMatchInlineSnapshot(`
      {
        "createdAt": "2025-01-01T12:00:00.000Z",
        "id": "recipe-123",
        "lastAdaptationExplanation": "Reduced salt to suit dietary needs.",
        "macros": {
          "carbs": 18,
          "fat": 22,
          "kcal": 640,
          "protein": 42,
        },
        "recipeText": "Season salmon and grill for 12 minutes, flipping once.",
        "servings": 4,
        "title": "Grilled Salmon",
        "updatedAt": "2025-01-02T08:30:00.000Z",
      }
    `);
  });

  it("preserves null adaptation explanations", () => {
    const row = createRecipeRow({ last_adaptation_explanation: null });

    const result = mapRecipeRowToDTO(row);

    expect(result.lastAdaptationExplanation).toBeNull();
  });

  it("does not mutate the source database row", () => {
    const row = createRecipeRow();
    const snapshot = { ...row };

    mapRecipeRowToDTO(row);

    expect(row).toStrictEqual(snapshot);
  });
});

describe("buildUpdatePayload", () => {
  it("maps provided fields to their database column counterparts", () => {
    const payload = buildUpdatePayload({
      title: "Updated Title",
      servings: 6,
      recipeText: "Updated recipe text",
      lastAdaptationExplanation: "Adjusted seasoning",
      macros: {
        kcal: 720,
        protein: 48,
        carbs: 22,
        fat: 26,
      },
    });

    expect(payload).toMatchInlineSnapshot(`
      {
        "carbs": 22,
        "fat": 26,
        "kcal": 720,
        "last_adaptation_explanation": "Adjusted seasoning",
        "protein": 48,
        "recipe_text": "Updated recipe text",
        "servings": 6,
        "title": "Updated Title",
      }
    `);
  });

  it("omits fields that are undefined and preserves explicit nulls", () => {
    const payload = buildUpdatePayload({
      title: undefined,
      lastAdaptationExplanation: null,
    });

    expect(payload).toStrictEqual({
      last_adaptation_explanation: null,
    });
  });

  it("returns an empty object when no values are provided", () => {
    const payload = buildUpdatePayload({});

    expect(payload).toStrictEqual({});
  });
});

describe("createRecipe", () => {
  it("inserts a new recipe and returns the mapped DTO", async () => {
    const row = createRecipeRow();
    const { supabase, builders } = createSupabaseClientMock(() => createQueryBuilder({ data: row, error: null }));

    const result = await createRecipe(supabase, "user-456", {
      title: row.title,
      servings: row.servings,
      macros: {
        kcal: row.kcal,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
      },
      recipeText: row.recipe_text,
      lastAdaptationExplanation: row.last_adaptation_explanation ?? undefined,
    });

    const builder = getBuilder(builders, 0);

    expect(builder.insert).toHaveBeenCalledWith({
      title: row.title,
      servings: row.servings,
      kcal: row.kcal,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      recipe_text: row.recipe_text,
      last_adaptation_explanation: row.last_adaptation_explanation,
      user_id: "user-456",
    });
    expect(builder.select).toHaveBeenCalledTimes(1);
    expect(builder.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mapRecipeRowToDTO(row));
  });

  it("throws a RecipeServiceError when insertion fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { supabase, builders } = createSupabaseClientMock(() =>
      createQueryBuilder({ data: null, error: new Error("insert failed") })
    );

    const action = () =>
      createRecipe(supabase, "user-456", {
        title: "Test",
        servings: 2,
        macros: { kcal: 200, protein: 10, carbs: 20, fat: 5 },
        recipeText: "Mix and serve",
      });

    const thrown = await action().catch((error) => error);

    expect(thrown).toBeInstanceOf(RecipeServiceError);
    expect(thrown).toMatchObject({
      code: "insert_failed",
      message: "Unable to create recipe",
    });

    const builder = getBuilder(builders, 0);
    expect(builder.insert).toHaveBeenCalled();
    expect(builder.select).toHaveBeenCalled();
    expect(builder.single).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("getRecipes", () => {
  it("returns paginated recipe data with filters applied", async () => {
    const query = createGetRecipesQuery({
      page: 2,
      pageSize: 2,
      search: "salmon",
      sortBy: "created_at",
      sortOrder: "asc",
      minKcal: 100,
      maxKcal: 800,
      minProtein: 15,
      maxProtein: 60,
    });

    const row = createRecipeRow();
    const { supabase, builders } = createSupabaseClientMock((callIndex) => {
      if (callIndex === 0) {
        return createQueryBuilder({ count: 1, error: null });
      }

      return createQueryBuilder({ data: [row], error: null });
    });

    const result = await getRecipes(supabase, "user-456", query);

    expect(result.data).toEqual([mapRecipeRowToDTO(row)]);
    expect(result.pagination).toEqual({
      page: query.page,
      pageSize: query.pageSize,
      totalItems: 1,
      totalPages: 1,
    });

    const countBuilder = getBuilder(builders, 0);
    const dataBuilder = getBuilder(builders, 1);

    expect(countBuilder.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(dataBuilder.select).toHaveBeenCalledWith("*");
    expect(dataBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(dataBuilder.range).toHaveBeenCalledWith(2, 3);

    expect(countBuilder.eq).toHaveBeenCalledWith("user_id", "user-456");
    expect(dataBuilder.eq).toHaveBeenCalledWith("user_id", "user-456");

    const expectedSearchClause = "title.ilike.%salmon%,recipe_text.ilike.%salmon%";
    expect(countBuilder.or).toHaveBeenCalledWith(expectedSearchClause, { foreignTable: undefined });
    expect(dataBuilder.or).toHaveBeenCalledWith(expectedSearchClause, { foreignTable: undefined });

    expect(countBuilder.gte).toHaveBeenCalledWith("kcal", 100);
    expect(countBuilder.lte).toHaveBeenCalledWith("kcal", 800);
    expect(dataBuilder.gte).toHaveBeenCalledWith("kcal", 100);
    expect(dataBuilder.lte).toHaveBeenCalledWith("kcal", 800);
    expect(countBuilder.gte).toHaveBeenCalledWith("protein", 15);
    expect(countBuilder.lte).toHaveBeenCalledWith("protein", 60);
    expect(dataBuilder.gte).toHaveBeenCalledWith("protein", 15);
    expect(dataBuilder.lte).toHaveBeenCalledWith("protein", 60);
  });

  it("throws a RecipeServiceError when counting fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const countError = new Error("count failed");
    const { supabase } = createSupabaseClientMock((callIndex) => {
      if (callIndex === 0) {
        return createQueryBuilder({ count: null, error: countError });
      }

      return createQueryBuilder({ data: [], error: null });
    });

    const thrown = await getRecipes(supabase, "user-456", createGetRecipesQuery()).catch((error) => error);

    expect(thrown).toBeInstanceOf(RecipeServiceError);
    expect(thrown).toMatchObject({
      code: "count_failed",
      message: "Unable to count recipes",
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("throws a RecipeServiceError when retrieving data fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dataError = new Error("fetch failed");
    const { supabase } = createSupabaseClientMock((callIndex) => {
      if (callIndex === 0) {
        return createQueryBuilder({ count: 0, error: null });
      }

      return createQueryBuilder({ data: null, error: dataError });
    });

    const thrown = await getRecipes(supabase, "user-456", createGetRecipesQuery()).catch((error) => error);

    expect(thrown).toBeInstanceOf(RecipeServiceError);
    expect(thrown).toMatchObject({
      code: "fetch_failed",
      message: "Unable to fetch recipes",
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("getRecipeById", () => {
  it("returns the mapped recipe when found", async () => {
    const row = createRecipeRow();
    const { supabase, builders } = createSupabaseClientMock(() => createQueryBuilder({ data: row, error: null }));

    const result = await getRecipeById(supabase, row.id, row.user_id);

    const builder = getBuilder(builders, 0);
    expect(builder.select).toHaveBeenCalledWith("*");
    expect(builder.eq).toHaveBeenCalledWith("id", row.id);
    expect(builder.eq).toHaveBeenCalledWith("user_id", row.user_id);
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mapRecipeRowToDTO(row));
  });

  it("returns null when no recipe exists", async () => {
    const { supabase } = createSupabaseClientMock(() => createQueryBuilder({ data: null, error: null }));

    const result = await getRecipeById(supabase, "missing", "user-456");

    expect(result).toBeNull();
  });

  it("throws a RecipeServiceError on query failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { supabase } = createSupabaseClientMock(() =>
      createQueryBuilder({ data: null, error: new Error("fetch failed") })
    );

    const thrown = await getRecipeById(supabase, "recipe-unknown", "user-456").catch((error) => error);

    expect(thrown).toBeInstanceOf(RecipeServiceError);
    expect(thrown).toMatchObject({
      code: "fetch_failed",
      message: "Unable to fetch recipe",
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("updateRecipe", () => {
  it("updates provided fields and returns minimal payload when requested", async () => {
    vi.useFakeTimers();
    const currentTimestamp = new Date("2025-03-01T09:00:00.000Z");
    vi.setSystemTime(currentTimestamp);

    const updatedRow = createRecipeRow({ updated_at: currentTimestamp.toISOString() });
    const { supabase, builders } = createSupabaseClientMock(() =>
      createQueryBuilder({ data: updatedRow, error: null })
    );

    const result = await updateRecipe(
      supabase,
      updatedRow.id,
      updatedRow.user_id,
      {
        title: "Updated Title",
        macros: {
          kcal: 700,
          protein: 45,
          carbs: 30,
          fat: 20,
        },
      },
      {
        returnMode: "minimal",
      }
    );

    const builder = getBuilder(builders, 0);
    expect(builder.update).toHaveBeenCalledWith({
      title: "Updated Title",
      kcal: 700,
      protein: 45,
      carbs: 30,
      fat: 20,
      updated_at: currentTimestamp.toISOString(),
    });
    expect(builder.eq).toHaveBeenCalledWith("id", updatedRow.id);
    expect(builder.eq).toHaveBeenCalledWith("user_id", updatedRow.user_id);
    expect(builder.maybeSingle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      id: updatedRow.id,
      updatedAt: updatedRow.updated_at,
      returnMode: "minimal",
    });

    vi.useRealTimers();
  });

  it("returns the updated recipe when returnMode is full", async () => {
    vi.useFakeTimers();
    const currentTimestamp = new Date("2025-04-01T10:00:00.000Z");
    vi.setSystemTime(currentTimestamp);

    const updatedRow = createRecipeRow({ updated_at: currentTimestamp.toISOString() });
    const { supabase } = createSupabaseClientMock(() => createQueryBuilder({ data: updatedRow, error: null }));

    const result = await updateRecipe(
      supabase,
      updatedRow.id,
      updatedRow.user_id,
      { recipeText: "Updated instructions" },
      { returnMode: "full" }
    );

    expect(result).toEqual({
      id: updatedRow.id,
      updatedAt: updatedRow.updated_at,
      returnMode: "full",
      recipe: mapRecipeRowToDTO(updatedRow),
    });

    vi.useRealTimers();
  });

  it("returns null when the recipe does not exist", async () => {
    const { supabase } = createSupabaseClientMock(() => createQueryBuilder({ data: null, error: null }));

    const result = await updateRecipe(supabase, "missing", "user-456", { title: "No-op" }, { returnMode: "minimal" });

    expect(result).toBeNull();
  });

  it("throws when update fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { supabase } = createSupabaseClientMock(() =>
      createQueryBuilder({ data: null, error: new Error("update failed") })
    );

    const thrown = await updateRecipe(
      supabase,
      "recipe-123",
      "user-456",
      { title: "Bad" },
      { returnMode: "minimal" }
    ).catch((error) => error);

    expect(thrown).toBeInstanceOf(RecipeServiceError);
    expect(thrown).toMatchObject({
      code: "update_failed",
      message: "Unable to update recipe",
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("throws when no update fields are provided", async () => {
    const { supabase, from } = createSupabaseClientMock(() => createQueryBuilder({ data: null, error: null }));

    const thrown = await updateRecipe(supabase, "recipe-123", "user-456", {}, { returnMode: "minimal" }).catch(
      (error) => {
        return error;
      }
    );

    expect(thrown).toBeInstanceOf(RecipeServiceError);
    expect(thrown).toMatchObject({
      code: "update_failed",
      message: "No fields provided for update",
    });
    expect(from).not.toHaveBeenCalled();
  });
});

describe("deleteRecipe", () => {
  it("returns true when a recipe is deleted", async () => {
    const { supabase, builders } = createSupabaseClientMock(() => createQueryBuilder({ count: 1, error: null }));

    const result = await deleteRecipe(supabase, "recipe-123", "user-456");

    const builder = getBuilder(builders, 0);
    expect(builder.delete).toHaveBeenCalledWith({ count: "exact" });
    expect(builder.eq).toHaveBeenCalledWith("id", "recipe-123");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-456");
    expect(result).toBe(true);
  });

  it("returns false when no rows are removed", async () => {
    const { supabase } = createSupabaseClientMock(() => createQueryBuilder({ count: 0, error: null }));

    const result = await deleteRecipe(supabase, "missing", "user-456");

    expect(result).toBe(false);
  });

  it("throws a RecipeServiceError when deletion fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deletionError = new Error("delete failed");
    const { supabase } = createSupabaseClientMock(() => createQueryBuilder({ count: null, error: deletionError }));

    const thrown = await deleteRecipe(supabase, "recipe-123", "user-456").catch((error) => error);

    expect(thrown).toBeInstanceOf(RecipeServiceError);
    expect(thrown).toMatchObject({
      code: "delete_failed",
      message: "Unable to delete recipe",
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
