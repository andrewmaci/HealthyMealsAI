import type { APIRoute } from "astro";

import { z } from "zod";

import { DEFAULT_USER_ID } from "../../../db/supabase.client";
import { getRecipeById, RecipeServiceError, updateRecipe } from "../../../lib/services/recipe.service";
import type { RecipeUpdateCommand, RecipeUpdateMinimalDTO, RecipeUpdateResponseDTO } from "../../../types";
import { RecipeUpdateDtoSchema } from "../../../types";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const RecipeIdSchema = z.string().uuid({ message: "Invalid recipe ID." });
const UpdateRecipeReturnSchema = z
  .enum(["minimal", "full"] as const)
  .default("full");

const buildValidationErrorResponse = (error: z.ZodError) =>
  buildJsonResponse(
    {
      error: "Validation failed.",
      details: error.flatten(),
    },
    400,
  );

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

export const PUT: APIRoute = async ({ params, request, url, locals }) => {
  const user = locals.session?.user;
  const userId = user?.id ?? DEFAULT_USER_ID;

  const idResult = RecipeIdSchema.safeParse(params.id);

  if (!idResult.success) {
    return buildValidationErrorResponse(idResult.error);
  }

  const returnModeResult = UpdateRecipeReturnSchema.safeParse(url.searchParams.get("return") ?? undefined);

  if (!returnModeResult.success) {
    return buildValidationErrorResponse(returnModeResult.error);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error("Failed to parse PUT /api/recipes/:id body", {
      userId,
      id: idResult.data,
      error,
    });

    return buildJsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const bodyResult = RecipeUpdateDtoSchema.safeParse(body);

  if (!bodyResult.success) {
    return buildValidationErrorResponse(bodyResult.error);
  }

  if (Object.keys(bodyResult.data).length === 0) {
    return buildJsonResponse({ error: "Request body must include at least one field." }, 400);
  }

  try {
    const updateResult = await updateRecipe(locals.supabase, idResult.data, userId, bodyResult.data as RecipeUpdateCommand, {
      returnMode: returnModeResult.data,
    });

    if (!updateResult) {
      return buildJsonResponse({ error: "Recipe not found." }, 404);
    }

    if (updateResult.returnMode === "minimal") {
      const response: RecipeUpdateResponseDTO = {
        data: {
          id: updateResult.id,
          updatedAt: updateResult.updatedAt,
        } satisfies RecipeUpdateMinimalDTO,
      };

      return buildJsonResponse(response, 200);
    }

    const response: RecipeUpdateResponseDTO = {
      data: updateResult.recipe,
    };

    return buildJsonResponse(response, 200);
  } catch (error) {
    if (error instanceof RecipeServiceError) {
      console.error("Recipe service error while updating recipe", {
        userId,
        id: idResult.data,
        error,
      });

      const status = error.code === "update_failed" ? 500 : 500;

      return buildJsonResponse({ error: error.message }, status);
    }

    console.error("Unexpected error while updating recipe", {
      userId,
      id: idResult.data,
      error,
    });

    return buildJsonResponse({ error: "Failed to update recipe" }, 500);
  }
};

