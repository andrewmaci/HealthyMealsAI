# API Endpoint Implementation Plan: POST /api/recipes

## 1. Endpoint Overview
This endpoint is responsible for creating a new recipe record in the database. It is an authenticated route, meaning only logged-in users can create recipes. The created recipe will be directly associated with the authenticated user's ID. The endpoint validates the incoming data for correctness, including type, presence, and adherence to business rules, before persisting it.

## 2. Request Details
- **HTTP Method:** `POST`
- **URL Structure:** `/api/recipes`
- **Parameters:** None
- **Request Body:**
  ```json
  {
    "title": "string",
    "servings": 4,
    "macros": {
      "kcal": 450.0,
      "protein": 30.0,
      "carbs": 55.0,
      "fat": 12.0
    },
    "recipeText": "string",
    "lastAdaptationExplanation": "string|null"
  }
  ```

## 3. Used Types
- **`RecipeCreateDtoSchema` (New):** A Zod schema to validate the incoming request body.
- **`RecipeCreateDto` (New):** A TypeScript type inferred from `RecipeCreateDtoSchema`.
- **`RecipeCreateCommand`:** Command object passed to the service layer, containing sanitized and validated data for recipe creation.
- **`RecipeDTO`:** Data Transfer Object for the recipe entity returned in the response.
- **`RecipeCreateResponseDTO`:** The standardized success response wrapper for `RecipeDTO`.

## 4. Response Details
- **Success (201 Created):**
  ```json
  {
    "data": {
      "id": "uuid",
      "title": "string",
      "servings": 4,
      "macros": {
        "kcal": 450.0,
        "protein": 30.0,
        "carbs": 55.0,
        "fat": 12.0
      },
      "recipeText": "string",
      "lastAdaptationExplanation": "string|null",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  }
  ```
- **Error:**
  - `400 Bad Request`: Validation failure. The response body will contain detailed error messages from Zod.
  - `401 Unauthorized`: User is not authenticated.
  - `422 Unprocessable Entity`: Numeric values in the request body exceed the allowed precision (e.g., more than 2 decimal places).
  - `500 Internal Server Error`: For any unexpected server-side errors, including database failures.

## 5. Data Flow
1. A `POST` request with the recipe data is sent to `/api/recipes`.
2. The Astro `POST` handler in `src/pages/api/recipes.ts` receives the request.
3. The handler checks for an authenticated user session in `Astro.locals.session`. If not found, it returns a `401` error.
4. The request body is parsed and validated against the newly created `RecipeCreateDtoSchema`. If validation fails, a `400` or `422` error is returned with details.
5. The validated data is mapped to a `RecipeCreateCommand` object.
6. The `createRecipe` function in `src/lib/services/recipe.service.ts` is called with the Supabase client instance, the authenticated user's ID, and the command object.
7. The service function constructs a new recipe record, including the `user_id`, and inserts it into the `recipes` table using the Supabase client.
8. The database returns the newly created recipe row.
9. The service function maps the returned `RecipeRow` to a `RecipeDTO` using the existing `mapRecipeRowToDTO` helper and return it.
10. The API handler receives the `RecipeDTO`, wraps it in a standard response structure, and returns it to the client with a `201 Created` status code.

## 6. Security Considerations
- **Authentication:** The route must be protected. The handler will verify the presence of a valid user session via `Astro.locals.session`. Unauthenticated requests will be rejected with a `401 Unauthorized` status.
- **Authorization:** The `user_id` for the new recipe will be sourced directly from the authenticated user's session token (`user.id`). This prevents a user from creating a recipe on behalf of another user.
- **Input Validation:** All incoming data will be strictly validated using a Zod schema to prevent common vulnerabilities like injection attacks and data corruption. This includes checking string lengths, numeric ranges, and data types. The `recipeText` and `lastAdaptationExplanation` fields will be sanitized to prevent XSS if they are ever rendered as HTML.
- **Data Integrity:** The database schema enforces data integrity with `NOT NULL` constraints, checks, and foreign key relationships.

## 7. Performance Considerations
- The operation involves a single `INSERT` into the `recipes` table, which is indexed on its primary key.
- For the expected load, this operation is considered low-cost and should be highly performant.
- The database connection is managed by the Supabase client, which handles connection pooling.
- No significant performance bottlenecks are anticipated for this endpoint.

## 8. Implementation Steps
1.  **Update `src/types.ts`:**
    -   Create a new Zod schema named `RecipeCreateDtoSchema` to validate the request body.
    -   It should validate `title`, `servings`, `macros` (including `kcal`, `protein`, `carbs`, `fat`), `recipeText`, and `lastAdaptationExplanation`.
    -   Enforce constraints from the database schema (e.g., `servings > 0`, `kcal >= 0`, string lengths).
    -   Add a `.refine()` check on numeric macro fields to ensure they do not have more than two decimal places, returning a `422` status code on failure.
    -   Export a new type `RecipeCreateDto` inferred from the schema.

2.  **Update `src/lib/services/recipe.service.ts`:**
    -   Add a new error code `insert_failed` to the `RecipeServiceErrorCode` type.
    -   Implement and export a new asynchronous function: `createRecipe(supabase: SupabaseClient, userId: string, command: RecipeCreateCommand): Promise<RecipeDTO>`.
    -   Inside this function, perform a Supabase `insert()` operation on the `recipes` table.
    -   The inserted data should include all fields from the `command` object, plus the `user_id`.
    -   The `insert()` should be combined with `.select().single()` to return the newly created record.
    -   If the database operation fails, throw a `RecipeServiceError` with the `insert_failed` code.
    -   On success, map the returned `RecipeRow` to a `RecipeDTO` using the existing `mapRecipeRowToDTO` helper and return it.

3.  **Update `src/pages/api/recipes.ts`:**
    -   Implement and export a new `POST` handler of type `APIRoute`.
    -   Add `export const prerender = false;`.
    -   Retrieve the user from `locals.session`. If no user, return a `401` error.
    -   Use a `try...catch` block to handle potential errors.
    -   Inside the `try` block, parse the JSON request body.
    -   Validate the body using `RecipeCreateDtoSchema.safeParse()`.
    -   If parsing fails, return a `400` response with the validation error details.
    -   Call the `recipe.service.createRecipe` function with the validated data.
    -   Use the `buildJsonResponse` helper to return the result from the service with a `201 Created` status code.
    -   In the `catch` block, log the error and return a generic `500 Internal Server Error` response.
