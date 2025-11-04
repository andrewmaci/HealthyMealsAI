import { describe, expect, it, vi } from "vitest";

import type { Tables } from "../../../../src/db/database.types";
import type { SupabaseClient } from "../../../../src/db/supabase.client";
import {
  RecipeServiceError,
  buildUpdatePayload,
  createRecipe,
  mapRecipeRowToDTO,
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

interface SupabaseRecipesBuilderMock {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const createSupabaseClientMock = (
  builderFactory: () => SupabaseRecipesBuilderMock
): {
  supabase: SupabaseClient;
  spies: SupabaseRecipesBuilderMock & { from: ReturnType<typeof vi.fn> };
} => {
  const builder = builderFactory();
  const from = vi.fn((table: string) => {
    if (table !== "recipes") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return builder;
  });

  const supabase = { from } as unknown as SupabaseClient;

  return {
    supabase,
    spies: {
      from,
      ...builder,
    },
  };
};

const createInsertBuilder = (response: { data: Tables<"recipes"> | null; error: unknown }) => {
  const single = vi.fn().mockResolvedValue(response);
  const builder: Partial<SupabaseRecipesBuilderMock> = {};
  builder.insert = vi.fn().mockReturnValue(builder);
  builder.select = vi.fn().mockReturnValue(builder);
  builder.single = single;
  return builder as SupabaseRecipesBuilderMock;
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
    const { supabase, spies } = createSupabaseClientMock(() => createInsertBuilder({ data: row, error: null }));

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

    expect(spies.from).toHaveBeenCalledWith("recipes");
    expect(spies.insert).toHaveBeenCalledWith({
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
    expect(spies.select).toHaveBeenCalledTimes(1);
    expect(spies.single).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mapRecipeRowToDTO(row));
  });

  it("throws a RecipeServiceError when insertion fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { supabase, spies } = createSupabaseClientMock(() =>
      createInsertBuilder({ data: null, error: new Error("insert failed") })
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

    expect(spies.insert).toHaveBeenCalled();
    expect(spies.select).toHaveBeenCalled();
    expect(spies.single).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
