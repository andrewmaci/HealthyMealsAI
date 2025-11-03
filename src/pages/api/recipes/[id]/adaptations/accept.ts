import type { APIRoute } from "astro";

import { z } from "zod";

import { AdaptationServiceError, acceptAdaptation } from "../../../../../lib/services/adaptation.service";
import { RecipeAdaptationAcceptDtoSchema } from "../../../../../types";
import type { RecipeAdaptationAcceptDto } from "../../../../../types";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const RecipeIdSchema = z.string().uuid();

export const POST: APIRoute = async ({ params, locals, request }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = sessionUser.id;
  const recipeIdResult = RecipeIdSchema.safeParse(params.id);

  if (!recipeIdResult.success) {
    return buildJsonResponse({ error: "Invalid recipe id." }, 400);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.warn("Failed to parse adaptation accept request body", {
      userId,
      recipeId: recipeIdResult.data,
      error,
    });

    return buildJsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const parsedBody = RecipeAdaptationAcceptDtoSchema.safeParse(body);

  if (!parsedBody.success) {
    return buildJsonResponse(
      {
        error: "Invalid request body.",
        details: parsedBody.error.flatten(),
      },
      400,
    );
  }

  const command: RecipeAdaptationAcceptDto = parsedBody.data;

  try {
    const updatedRecipe = await acceptAdaptation(locals.supabase, userId, recipeIdResult.data, command);

    return buildJsonResponse({ data: updatedRecipe }, 200);
  } catch (error) {
    if (error instanceof AdaptationServiceError) {
      switch (error.code) {
        case "recipe_not_found":
        case "proposal_not_found":
          return buildJsonResponse({ error: error.message }, 404);
        case "accept_failed":
          return buildJsonResponse({ error: "Failed to accept adaptation." }, 500);
        case "history_fetch_failed": // This can happen if there's a DB error during ownership verification
          return buildJsonResponse({ error: "Failed to verify adaptation proposal." }, 500);
        default:
          console.error("Adaptation service error during accept", {
            userId,
            recipeId: recipeIdResult.data,
            code: error.code,
            error,
          });

          return buildJsonResponse({ error: "Failed to process adaptation acceptance." }, 500);
      }
    }

    console.error("Unexpected error while accepting adaptation", {
      userId,
      recipeId: recipeIdResult.data,
      error,
    });

    return buildJsonResponse({ error: "Failed to process adaptation acceptance." }, 500);
  }
};