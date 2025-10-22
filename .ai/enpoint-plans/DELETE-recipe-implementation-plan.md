# API Endpoint Implementation Plan: DELETE /api/recipes/{id}

## 1. Endpoint Overview

This endpoint permanently deletes a recipe identified by its `id`. To prevent accidental deletion, it supports an optional confirmation mechanism. The operation is restricted to the owner of the recipe. Upon successful deletion, associated adaptation logs are handled according to the foreign key constraint (`ON DELETE SET NULL`), preserving the log history while unlinking it from the deleted recipe.

## 2. Request Details

-   **HTTP Method:** `DELETE`
-   **URL Structure:** `/api/recipes/{id}`
-   **Parameters:**
    -   **Path Parameters:**
        -   `id` (UUID, required): The unique identifier for the recipe to be deleted.
    -   **Query Parameters:**
        -   `confirm` (boolean, optional): A flag to confirm the deletion. e.g., `?confirm=true`.
-   **Request Body:**
    -   An optional JSON body for providing confirmation, symmetric with UI flows.
    ```json
    {
      "confirmation": true
    }
    ```

## 3. Used Types

-   `RecipeDeleteCommand`: Represents the optional request body.
-   A Zod schema will be created to validate path, query, and body parameters.

## 4. Response Details

-   **Success (204 No Content):**
    -   An empty response body indicating that the recipe was successfully deleted.
-   **Error Responses:**
    -   **400 Bad Request:** The `id` is invalid, or confirmation was required but not provided.
    -   **401 Unauthorized:** The user is not authenticated.
    -   **404 Not Found:** The recipe does not exist or is not owned by the user.
    -   **409 Conflict:** The resource cannot be deleted at this time (e.g., pending operations).
    -   **500 Internal Server Error:** An unexpected server-side error occurred.

## 5. Data Flow

1.  The client sends a `DELETE` request to `/api/recipes/{id}`, optionally including a confirmation query parameter or request body.
2.  Astro middleware authenticates the user and attaches the session to `context.locals`.
3.  The API route handler (`src/pages/api/recipes.ts`) receives the request.
4.  The handler validates the `id` from the path.
5.  The handler checks for the presence of `confirm=true` in the query or `confirmation: true` in the body. If a confirmation mechanism is enforced and not met, it returns a `400 Bad Request`.
6.  The handler calls the `recipe.service.ts` with the `id` and the `userId`.
7.  The service layer executes a `DELETE` query in Supabase: `supabase.from('recipes').delete().eq('id', id).eq('user_id', userId)`.
8.  The service checks the result of the delete operation. Supabase can indicate how many rows were affected. If zero rows were affected, it means the recipe was not found for that user.
9.  The service returns a status (e.g., `true` for success, `false` for not found) to the handler.
10. If the service indicates "not found," the handler returns a `404 Not Found`.
11. If the service indicates success, the handler returns a `204 No Content` response.

## 6. Security Considerations

-   **Authentication & Authorization:** Deletion is a destructive action and must be strictly controlled. The `user_id` must be used in the `WHERE` clause of the `DELETE` statement to ensure users can only delete their own recipes.
-   **Accidental Deletion:** The optional confirmation parameter provides a safeguard. While the API spec marks it as optional, the implementation can be designed to be configurable, allowing for confirmation to be enforced application-wide if desired.
-   **Cross-Site Request Forgery (CSRF):** As this is a state-changing endpoint, CSRF protection is important. Astro's middleware or integrations should be configured to handle CSRF tokens, especially for requests originating from web browsers.

## 7. Performance Considerations

-   **Database Deletion:** Deleting a single row by its primary key is a highly efficient operation.
-   **Cascading Effects:** The `ON DELETE SET NULL` operation on the `adaptation_logs` table will trigger an update on related rows. This is generally efficient, but performance could be a consideration if a single recipe has an extremely large number of adaptation logs. An index on `adaptation_logs.recipe_id` is crucial.

## 8. Implementation Steps

1.  **Define Zod Schemas:**
    -   In `src/pages/api/recipes.ts`, create a schema to validate the request parameters.
    ```typescript
    const DeleteRecipeQuerySchema = z.object({
      confirm: z.coerce.boolean().optional(),
    });
    
    const DeleteRecipeBodySchema = z.object({
      confirmation: z.boolean().optional(),
    });
    ```

2.  **Update `recipe.service.ts`:**
    -   Create a new method: `deleteRecipe(id: string, userId: string): Promise<boolean>`.
    -   The method will execute a Supabase delete query: `const { error, count } = await supabase.from('recipes').delete({ count: 'exact' }).eq('id', id).eq('user_id', userId);`
    -   Check for errors during the deletion.
    -   The method will return `true` if `count` is 1 (or greater, though it should be 1), and `false` if `count` is 0, indicating the recipe was not found for that user.

3.  **Implement DELETE Handler in `src/pages/api/recipes.ts`:**
    -   Create an `async function DELETE({ params, request, context, url })` handler.
    -   Extract `userId` from `context.locals`.
    -   Validate `params.id` as a UUID.
    -   Parse and validate query params with `DeleteRecipeQuerySchema` and the request body with `DeleteRecipeBodySchema`.
    -   Check if confirmation is provided in either the query or the body. For this plan, we will simply note it and not enforce it, but a real implementation could add logic here.
    -   Call `recipeService.deleteRecipe(id, userId)`.
    -   If the service returns `false`, respond with `404 Not Found`.
    -   If the service returns `true`, respond with `204 No Content`.
    -   Wrap the logic in a `try...catch` block to handle unexpected server errors with a `500` status code.
