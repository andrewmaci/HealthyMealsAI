import type { APIRoute } from "astro";

import { z } from "zod";

import { AdaptationServiceError, getAdaptationHistory, proposeAdaptation } from "../../../../../lib/services/adaptation.service";
import {
  GetRecipeAdaptationHistoryQuerySchema,
  RecipeAdaptationRequestDtoSchema,
} from "../../../../../types";
import type { RecipeAdaptationRequestDto } from "../../../../../types";

export const prerender = false;

const buildJsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });

const RecipeIdSchema = z.string().uuid();

export const GET: APIRoute = async ({ params, url, locals }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = sessionUser.id;
  const recipeIdResult = RecipeIdSchema.safeParse(params.id);

  if (!recipeIdResult.success) {
    return buildJsonResponse({ error: "Invalid recipe id." }, 400);
  }

  const queryResult = GetRecipeAdaptationHistoryQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!queryResult.success) {
    return buildJsonResponse({ error: "Invalid query parameters." }, 400);
  }

  try {
    const history = await getAdaptationHistory(locals.supabase, userId, recipeIdResult.data, queryResult.data);

    return buildJsonResponse(history, 200);
  } catch (error) {
    if (error instanceof AdaptationServiceError) {
      if (error.code === "recipe_not_found") {
        return buildJsonResponse({ error: "Recipe not found." }, 404);
      }

      console.error("Adaptation history service error", {
        userId,
        recipeId: recipeIdResult.data,
        code: error.code,
        error,
      });

      return buildJsonResponse({ error: "Failed to fetch adaptation history." }, 500);
    }

    console.error("Unexpected error while fetching adaptation history", {
      userId,
      recipeId: recipeIdResult.data,
      error,
    });

    return buildJsonResponse({ error: "Failed to fetch adaptation history." }, 500);
  }
};

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
    console.warn("Failed to parse adaptation request body", {
      userId,
      recipeId: recipeIdResult.data,
      error,
    });

    return buildJsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const parsedBody = RecipeAdaptationRequestDtoSchema.safeParse(body);

  if (!parsedBody.success) {
    return buildJsonResponse(
      {
        error: "Invalid request body.",
        details: parsedBody.error.flatten(),
      },
      400,
    );
  }

  const command: RecipeAdaptationRequestDto = parsedBody.data;
  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;

  try {
    const result = await proposeAdaptation(locals.supabase, userId, recipeIdResult.data, command, {
      idempotencyKey,
    });

    if (result.status === "pending") {
      return buildJsonResponse(result.response, 202);
    }

    return buildJsonResponse({ data: result.proposal }, 200);
  } catch (error) {
    if (error instanceof AdaptationServiceError) {
      switch (error.code) {
        case "recipe_not_found":
          return buildJsonResponse({ error: "Recipe not found." }, 404);
        case "quota_exceeded":
          return buildJsonResponse({ error: "Daily adaptation quota exceeded." }, 403);
        case "adaptation_in_progress":
          return buildJsonResponse({ error: "An adaptation is already in progress for this recipe." }, 409);
        case "invalid_idempotency_key":
          return buildJsonResponse({ error: error.message }, 400);
        case "proposal_generation_failed":
          console.error("Proposal generation failed", {
            userId,
            recipeId: recipeIdResult.data,
            errorMessage: error.message,
            cause: error.cause,
          });
          return buildJsonResponse({ error: "Failed to generate adaptation proposal." }, 500);
        case "quota_fetch_failed":
          console.error("Quota fetch failed", {
            userId,
            recipeId: recipeIdResult.data,
            errorMessage: error.message,
            cause: error.cause,
          });
          return buildJsonResponse({ error: "Failed to fetch user profile or quota." }, 500);
        case "ai_timeout":
          return buildJsonResponse({ error: "AI service timeout. Please try again." }, 504);
        case "ai_unprocessable":
          console.error("AI unprocessable error", {
            userId,
            recipeId: recipeIdResult.data,
            errorMessage: error.message,
            cause: error.cause,
          });
          return buildJsonResponse({ error: "Unable to process adaptation request. Please try again." }, 422);
        default:
          console.error("Adaptation service error during proposal (unhandled code)", {
            userId,
            recipeId: recipeIdResult.data,
            code: error.code,
            message: error.message,
            cause: error.cause,
            stack: error.stack,
          });

          return buildJsonResponse({
            error: "Failed to process adaptation request.",
            details: error.message,
            errorCode: error.code,
          }, 500);
      }
    }

    console.error("Unexpected error while proposing adaptation (not AdaptationServiceError)", {
      userId,
      recipeId: recipeIdResult.data,
      errorType: error?.constructor?.name,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return buildJsonResponse(
      {
        error: "Failed to process adaptation request.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
};


