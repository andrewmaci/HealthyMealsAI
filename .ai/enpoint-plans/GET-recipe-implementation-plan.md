# API Endpoint Implementation Plan: GET /api/recipes/{id}

## 1. Endpoint Overview

This endpoint retrieves a single recipe by its unique identifier (`id`). It ensures that the requesting user is the owner of the recipe before returning it. The endpoint is read-only and serves to provide detailed information about a specific recipe.

## 2. Request Details

-   **HTTP Method:** `GET`
-   **URL Structure:** `/api/recipes/{id}`
-   **Parameters:**
    -   **Path Parameters:**
        -   `id` (UUID, required): The unique identifier of the recipe to retrieve.
    -   **Query Parameters:** None.
-   **Request Body:** None.

## 3. Used Types

-   `RecipeDTO`: Represents the structure of a single recipe object returned to the client.
-   `RecipeResponseDTO`: The standard wrapper for the response, containing the `data` field with the `RecipeDTO`.

## 4. Response Details

-   **Success (200 OK):**
    -   The response body will contain a JSON object conforming to the `RecipeResponseDTO` interface.
    ```json
    {
      "data": {
        "id": "uuid-string",
        "title": "string",
        "servings": "integer",
        "macros": {
          "kcal": "number",
          "protein": "number",
          "carbs": "number",
          "fat": "number"
        },
        "recipeText": "string",
        "lastAdaptationExplanation": "string | null",
        "createdAt": "ISO-8601-string",
        "updatedAt": "ISO-8601-string"
      }
    }
    ```
-   **Error Responses:**
    -   **400 Bad Request:** The provided `id` is not a valid UUID.
    -   **401 Unauthorized:** The user is not authenticated.
    -   **404 Not Found:** No recipe exists with the given `id`, or the recipe is not owned by the authenticated user.
    -   **500 Internal Server Error:** An unexpected server-side error occurred.

## 5. Data Flow

1.  The client sends a `GET` request to `/api/recipes/{id}`.
2.  The Astro middleware verifies the user's authentication status. If the user is not authenticated, it returns a `401 Unauthorized` error. The user's session and ID are attached to `context.locals`.
3.  The API route handler (`src/pages/api/recipes.ts`) receives the request.
4.  The handler extracts the `id` from the URL path and validates it as a UUID. If invalid, it returns a `400 Bad Request`.
5.  The handler calls the `recipe.service.ts` layer, passing the `id` and the authenticated `userId` from `context.locals`.
6.  The service layer queries the Supabase database to find a recipe matching both the `id` and `userId`.
7.  If the database query returns a recipe, the service layer maps the database row to a `RecipeDTO` and returns it to the handler.
8.  If no recipe is found, the service returns `null`.
9.  The handler checks the result from the service. If `null`, it returns a `404 Not Found` response.
10. If a `RecipeDTO` is returned, the handler wraps it in a `RecipeResponseDTO` and sends a `200 OK` response with the recipe data.

## 6. Security Considerations

-   **Authentication:** All requests to this endpoint must be authenticated. This will be enforced by the Astro middleware, which should check for a valid Supabase session.
-   **Authorization:** The core security measure is ensuring that a user can only access their own recipes. This is achieved by including a `WHERE user_id = :userId` clause in the database query within the service layer. This prevents unauthorized data access.
-   **Input Validation:** The `id` path parameter must be strictly validated as a UUID to prevent potential injection attacks or unexpected database behavior.

## 7. Performance Considerations

-   **Database Query:** The database lookup is the primary performance factor. The query should be efficient, using the primary key (`id`) and an index on `user_id` for fast retrieval. The `recipes` table should have an index on `(user_id, id)`.
-   **Payload Size:** The `RecipeDTO` payload is expected to be small. No significant performance impact is anticipated from data serialization or transfer.

## 8. Implementation Steps

1.  **Create Zod Schema for Path Parameter:**
    -   In `src/pages/api/recipes.ts`, define a Zod schema to validate the `id` from the URL.
    -   `const RecipeIdSchema = z.string().uuid({ message: "Invalid recipe ID." });`

2.  **Update `recipe.service.ts`:**
    -   Create a new public method: `getRecipeById(id: string, userId: string): Promise<RecipeDTO | null>`.
    -   This method will execute a Supabase query: `supabase.from('recipes').select('*').eq('id', id).eq('user_id', userId).single()`.
    -   Handle the case where no recipe is found (Supabase returns `null`).
    -   If a recipe is found, map the database row (`RecipeRow`) to a `RecipeDTO`. Create a private helper function for this mapping to ensure consistency.

3.  **Implement GET Handler in `src/pages/api/recipes.ts`:**
    -   Create an `async function GET({ params, context })` handler.
    -   Ensure `export const prerender = false;` is set.
    -   Extract the user ID from `context.locals.user.id`. If not present, the middleware should have already returned a 401.
    -   Parse and validate `params.id` using `RecipeIdSchema`. If validation fails, return a `400 Bad Request` with the validation errors.
    -   Call `recipeService.getRecipeById()` with the validated `id` and `userId`.
    -   If the service returns `null`, return a `404 Not Found` response.
    -   If the service returns a `RecipeDTO`, wrap it in a `StandardResponse`, and return a `200 OK` JSON response.
    -   Add a `try...catch` block to handle unexpected errors and return a `500 Internal Server Error`.
