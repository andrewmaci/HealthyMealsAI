import type { APIRoute } from "astro";

import { GetRecipesQuerySchema } from "../../types";
import { getRecipes, RecipeServiceError } from "../../lib/services/recipe.service";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

export const GET: APIRoute = async ({ locals, request }) => {
  const user = locals.session?.user;

  if (!user) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

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
    const result = await getRecipes(locals.supabase, user.id, validatedQuery);

    return buildJsonResponse(result, 200);
  } catch (error) {
    if (error instanceof RecipeServiceError) {
      console.error("Recipe service error", { userId: user.id, code: error.code, error });
      return buildJsonResponse({ error: error.message }, 500);
    }

    console.error("Unexpected error while fetching recipes", { userId: user.id, error });
    return buildJsonResponse({ error: "Failed to fetch recipes" }, 500);
  }
};

