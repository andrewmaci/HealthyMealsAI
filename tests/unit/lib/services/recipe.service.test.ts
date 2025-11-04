import { describe, expect, it } from "vitest";

import type { Tables } from "../../../../src/db/database.types";
import { buildUpdatePayload, mapRecipeRowToDTO } from "../../../../src/lib/services/recipe.service";

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
