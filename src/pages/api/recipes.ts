import type { APIRoute } from "astro";

import { DEFAULT_USER_ID } from "../../db/supabase.client";
import { GetRecipesQuerySchema, RecipeCreateDtoSchema } from "../../types";
import { createRecipe, getRecipes, RecipeServiceError } from "../../lib/services/recipe.service";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

export const GET: APIRoute = async ({ locals, request }) => {
  const userId = locals.session?.user?.id ?? DEFAULT_USER_ID;

  const searchParams = Object.fromEntries(new URL(request.url).searchParams);
  const parseResult = GetRecipesQuerySchema.safeParse(searchParams);

  if (!parseResult.success) {
    return buildJsonResponse({
      error: "Validation failed.",
      details: parseResult.error.flatten(),
    }, 400);
  }

  const validatedQuery = parseResult.data;

  try {
    const result = await getRecipes(locals.supabase, userId, validatedQuery);

    return buildJsonResponse(result, 200);
  } catch (error) {
    if (error instanceof RecipeServiceError) {
      console.error("Recipe service error", { userId, code: error.code, error });
      return buildJsonResponse({ error: error.message }, 500);
    }

    console.error("Unexpected error while fetching recipes", { userId, error });
    return buildJsonResponse({ error: "Failed to fetch recipes" }, 500);
  }
};

export const POST: APIRoute = async ({ locals, request }) => {
  const userId = locals.session?.user?.id ?? DEFAULT_USER_ID;

  try {
    const payload = await request.json();
    const parseResult = RecipeCreateDtoSchema.safeParse(payload);

    if (!parseResult.success) {
      return buildJsonResponse(
        {
          error: "Validation failed.",
          details: parseResult.error.flatten(),
        },
        400,
      );
    }

    const validatedPayload = parseResult.data;
    const result = await createRecipe(locals.supabase, userId, {
      title: validatedPayload.title,
      servings: validatedPayload.servings,
      macros: validatedPayload.macros,
      recipeText: validatedPayload.recipeText,
      lastAdaptationExplanation: validatedPayload.lastAdaptationExplanation ?? undefined,
    });

    return buildJsonResponse({ data: result }, 201);
  } catch (error) {
    if (error instanceof RecipeServiceError) {
      console.error("Recipe service error during creation", { userId, code: error.code, error });

      if (error.code === "insert_failed") {
        return buildJsonResponse({ error: error.message }, 422);
      }

      return buildJsonResponse({ error: error.message }, 500);
    }

    console.error("Unexpected error while creating recipe", { userId, error });
    return buildJsonResponse({ error: "Failed to create recipe" }, 500);
  }
};

