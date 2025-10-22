import type { APIRoute } from "astro";

import { z } from "zod";

import { DEFAULT_USER_ID } from "../../../db/supabase.client";
import { getRecipeById, RecipeServiceError } from "../../../lib/services/recipe.service";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const RecipeIdSchema = z.string().uuid({ message: "Invalid recipe ID." });

export const GET: APIRoute = async ({ params, locals }) => {
  const user = locals.session?.user;

  const userId = user?.id ?? DEFAULT_USER_ID;

  const validationResult = RecipeIdSchema.safeParse(params.id);

  if (!validationResult.success) {
    return buildJsonResponse(
      {
        error: "Validation failed.",
        details: validationResult.error.flatten(),
      },
      400,
    );
  }

  try {
    const recipe = await getRecipeById(locals.supabase, validationResult.data, userId);

    if (!recipe) {
      return buildJsonResponse({ error: "Recipe not found." }, 404);
    }

    return buildJsonResponse({ data: recipe }, 200);
  } catch (error) {
    if (error instanceof RecipeServiceError) {
      console.error("Recipe service error while fetching recipe", { userId, id: validationResult.data, error });

      return buildJsonResponse({ error: error.message }, 500);
    }

    console.error("Unexpected error while fetching recipe", { userId, id: validationResult.data, error });

    return buildJsonResponse({ error: "Failed to fetch recipe" }, 500);
  }
};

