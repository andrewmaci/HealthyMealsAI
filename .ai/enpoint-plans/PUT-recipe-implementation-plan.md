# API Endpoint Implementation Plan: PUT /api/recipes/{id}

## 1. Endpoint Overview

This endpoint updates an existing recipe identified by its `id`. It allows for partial updates, meaning the client only needs to send the fields they wish to change. The endpoint ensures that only the owner of the recipe can perform updates. It also provides an option to return either the full updated recipe object or a minimal response containing only the `id` and `updatedAt` timestamp.

## 2. Request Details

-   **HTTP Method:** `PUT`
-   **URL Structure:** `/api/recipes/{id}`
-   **Parameters:**
    -   **Path Parameters:**
        -   `id` (UUID, required): The unique identifier of the recipe to update.
    -   **Query Parameters:**
        -   `return` (string, optional): Controls the response body. Can be `minimal` or `full`. Defaults to `full`.
-   **Request Body:**
    -   A JSON object containing any subset of the fields from the `RecipeCreateDto`. All fields are optional.
    ```json
    {
      "title": "New Recipe Title",
      "servings": 2,
      "macros": {
        "kcal": 550.50,
        "protein": 30.00,
        "carbs": 45.00,
        "fat": 25.00
      },
      "recipeText": "Updated instructions...",
      "lastAdaptationExplanation": "Adjusted for lower calories."
    }
    ```

## 3. Used Types

-   `RecipeUpdateDto`: A Zod schema to validate the incoming request body.
-   `RecipeUpdateCommand`: Represents the data structure for updating a recipe.
-   `RecipeDTO`: The full recipe data transfer object for the `full` response.
-   `RecipeUpdateMinimalDTO`: The minimal data transfer object for the `minimal` response.
-   `RecipeUpdateResponseDTO`: A wrapper for the response.

## 4. Response Details

-   **Success (200 OK):**
    -   If `return=full` (or is omitted), the body contains the complete updated `RecipeDTO` wrapped in a `StandardResponse`.
    ```json
    {
      "data": {
        "id": "uuid-string",
        "title": "New Recipe Title",
        ... // all other recipe fields
        "updatedAt": "new-ISO-8601-string"
      }
    }
    ```
    -   If `return=minimal`, the body contains a minimal response.
    ```json
    {
      "data": {
        "id": "uuid-string",
        "updatedAt": "new-ISO-8601-string"
      }
    }
    ```
-   **Error Responses:**
    -   **400 Bad Request:** Invalid request body, `id`, or `return` parameter.
    -   **401 Unauthorized:** The user is not authenticated.
    -   **404 Not Found:** The recipe does not exist or is not owned by the user.
    -   **409 Conflict:** (Future) Optimistic concurrency check fails.
    -   **500 Internal Server Error:** An unexpected server-side error occurred.

## 5. Data Flow

1.  The client sends a `PUT` request to `/api/recipes/{id}` with the update payload and optional `return` query parameter.
2.  Astro middleware verifies the user's authentication and attaches the user session to `context.locals`.
3.  The API route handler (`src/pages/api/recipes.ts`) validates the `id` path parameter and the `return` query parameter.
4.  The handler validates the request body against the `RecipeUpdateDtoSchema`. If any validation fails, a `400 Bad Request` is returned.
5.  The handler calls the `recipe.service.ts` layer, passing the `id`, `userId`, and the validated update payload (`RecipeUpdateCommand`).
6.  The service layer first verifies that the recipe exists and is owned by the user by performing a preliminary check. If not, it returns an indicator of failure (e.g., `null`).
7.  If the recipe exists, the service constructs and executes an `update` query in Supabase with the provided data.
8.  The service layer returns the updated recipe data, either the full object or just the `id` and `updatedAt` timestamp, based on what is requested or needed for the response.
9.  The handler receives the result from the service. If the result indicates a "not found" scenario, it returns a `404 Not Found`.
10. The handler constructs the appropriate response (`full` or `minimal`) and sends a `200 OK`.

## 6. Security Considerations

-   **Authentication & Authorization:** Updates are strictly limited to authenticated users and the owners of the respective recipes. The `user_id` check in the `WHERE` clause of the `UPDATE` statement is critical.
-   **Data Validation:** A robust Zod schema (`RecipeUpdateDtoSchema`) must be used to validate and sanitize all incoming data, preventing invalid or malicious data from being saved. This includes checking data types, lengths, and ranges.
-   **Mass Assignment:** The service should only map fields defined in the `RecipeUpdateCommand`, preventing any unintended fields from the request body from being persisted to the database.

## 7. Performance Considerations

-   **Database Update:** The `UPDATE` operation on the `recipes` table should be fast as it targets a single row by its primary key (`id`).
-   **Database Read:** To verify ownership before updating and to return the full updated object, a `SELECT` query might be needed. This can be combined with the `UPDATE` using a `RETURNING *` clause in PostgreSQL for efficiency, which Supabase's `.update().select()` method supports.

## 8. Implementation Steps

1.  **Define Zod Schemas in `src/types.ts`:**
    -   Create `RecipeUpdateDtoSchema` by making all fields in `RecipeCreateDtoSchema` optional. This can be achieved using `.partial()`.
    -   `export const RecipeUpdateDtoSchema = RecipeCreateDtoSchema.partial();`

2.  **Define Zod Schema for Query/Path Params:**
    -   In `src/pages/api/recipes.ts`, define a schema for path and query parameters.
    -   `const UpdateRecipeParamsSchema = z.object({ id: z.string().uuid(), return: z.enum(["minimal", "full"]).default("full") });`

3.  **Update `recipe.service.ts`:**
    -   Create a new method: `updateRecipe(id: string, userId: string, data: RecipeUpdateCommand): Promise<RecipeDTO | null>`.
    -   The method should first verify the recipe exists and belongs to the user. A single `update` query with a `where` clause for both `id` and `user_id` can achieve this atomically.
    -   Use Supabase client: `supabase.from('recipes').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', userId).select().single()`.
    -   If the update is successful, Supabase returns the updated row. If no row is updated (because it wasn't found or the `user_id` didn't match), it will return an error or null data, which should be handled.
    -   Map the returned row to a `RecipeDTO` and return it. If the update affected no rows, return `null`.

4.  **Implement PUT Handler in `src/pages/api/recipes.ts`:**
    -   Create an `async function PUT({ params, request, context, url })` handler.
    -   Extract `userId` from `context.locals`.
    -   Parse `params` and `url.searchParams` using `UpdateRecipeParamsSchema`.
    -   Parse the JSON request body and validate it with `RecipeUpdateDtoSchema`. Handle parsing and validation errors with a `400 Bad Request`.
    -   Call `recipeService.updateRecipe()` with the validated data.
    -   If the service returns `null`, respond with `404 Not Found`.
    -   If successful, check the `return` parameter.
        -   If `minimal`, create a `RecipeUpdateMinimalDTO` from the result and respond.
        -   If `full`, respond with the full `RecipeDTO`.
    -   Wrap the response in `StandardResponse` and return `200 OK`.
    -   Use a `try...catch` block for server errors.
