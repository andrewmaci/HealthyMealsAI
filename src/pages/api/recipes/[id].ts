import type { APIRoute } from "astro";

import { z } from "zod";

import { deleteRecipe, getRecipeById, RecipeServiceError, updateRecipe } from "../../../lib/services/recipe.service";
import type {
  RecipeDeleteCommand,
  RecipeUpdateCommand,
  RecipeUpdateMinimalDTO,
  RecipeUpdateResponseDTO,
} from "../../../types";
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
const UpdateRecipeReturnSchema = z.enum(["minimal", "full"] as const).default("full");

const DeleteRecipeQuerySchema = z.object({
  confirm: z.coerce.boolean().optional(),
});

const DeleteRecipeBodySchema = z
  .object({
    confirmation: z.boolean().optional(),
  })
  .strict();

const getDeleteRequestCommand = async (request: Request): Promise<RecipeDeleteCommand> => {
  const contentLength = request.headers.get("content-length");

  if (contentLength === null || Number(contentLength) === 0) {
    return {};
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch (error) {
    console.error("Failed to parse DELETE /api/recipes/:id body", { error });

    throw buildJsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const result = DeleteRecipeBodySchema.safeParse(body);

  if (!result.success) {
    throw result.error;
  }

  return result.data;
};

export const DELETE: APIRoute = async ({ params, request, url, locals }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = sessionUser.id;

  const idResult = RecipeIdSchema.safeParse(params.id);

  if (!idResult.success) {
    return buildValidationErrorResponse(idResult.error);
  }

  const confirmParam = url.searchParams.get("confirm") ?? undefined;
  const queryResult = DeleteRecipeQuerySchema.safeParse({ confirm: confirmParam });

  if (!queryResult.success) {
    return buildValidationErrorResponse(queryResult.error);
  }

  let command: RecipeDeleteCommand;

  try {
    command = await getDeleteRequestCommand(request);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    if (error instanceof z.ZodError) {
      return buildValidationErrorResponse(error);
    }

    console.error("Unexpected error while parsing delete request body", { error });

    return buildJsonResponse({ error: "Invalid request body." }, 400);
  }

  const isConfirmed = queryResult.data.confirm === true || command.confirmation === true;
  const confirmationProvided = queryResult.data.confirm !== undefined || command.confirmation !== undefined;

  if (confirmationProvided && !isConfirmed) {
    return buildJsonResponse({ error: "Deletion requires confirmation." }, 400);
  }

  try {
    const deleted = await deleteRecipe(locals.supabase, idResult.data, userId);

    if (!deleted) {
      return buildJsonResponse({ error: "Recipe not found." }, 404);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof RecipeServiceError) {
      console.error("Recipe service error while deleting recipe", {
        userId,
        id: idResult.data,
        error,
      });

      return buildJsonResponse({ error: error.message }, 500);
    }

    console.error("Unexpected error while deleting recipe", {
      userId,
      id: idResult.data,
      error,
    });

    return buildJsonResponse({ error: "Failed to delete recipe" }, 500);
  }
};

const buildValidationErrorResponse = (error: z.ZodError) =>
  buildJsonResponse(
    {
      error: "Validation failed.",
      details: error.flatten(),
    },
    400
  );

export const GET: APIRoute = async ({ params, locals }) => {
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = sessionUser.id;

  const validationResult = RecipeIdSchema.safeParse(params.id);

  if (!validationResult.success) {
    return buildJsonResponse(
      {
        error: "Validation failed.",
        details: validationResult.error.flatten(),
      },
      400
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
  const sessionUser = locals.session?.user;

  if (!sessionUser) {
    return buildJsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = sessionUser.id;

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
    const updateResult = await updateRecipe(
      locals.supabase,
      idResult.data,
      userId,
      bodyResult.data as RecipeUpdateCommand,
      {
        returnMode: returnModeResult.data,
      }
    );

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
