# API Endpoint Implementation Plan: GET /api/recipes

## 1. Endpoint Overview
This document outlines the implementation plan for the `GET /api/recipes` endpoint. The endpoint's purpose is to retrieve a list of recipes associated with the currently authenticated user. It supports pagination, sorting, and filtering based on a search query and macronutrient ranges.

## 2. Request Details
- **HTTP Method**: `GET`
- **URL Structure**: `/api/recipes`
- **Parameters**:
  - **Query Parameters (Optional)**:
    - `page`: `integer` (≥ 1, default: `1`) - The page number for pagination.
    - `pageSize`: `integer` (1-50, default: `10`) - The number of items per page.
    - `search`: `string` - A search term to filter recipes by title or recipe text (case-insensitive).
    - `sortBy`: `string` (`created_at` | `updated_at` | `title`, default: `updated_at`) - The field to sort the recipes by.
    - `sortOrder`: `string` (`asc` | `desc`, default: `desc`) - The order for sorting.
    - `minKcal`: `number` (≥ 0) - Minimum kilocalories.
    - `maxKcal`: `number` (≥ 0) - Maximum kilocalories.
    - `minProtein`: `number` (≥ 0) - Minimum protein in grams.
    - `maxProtein`: `number` (≥ 0) - Maximum protein in grams.
- **Request Body**: None.

## 3. Used Types
- **DTOs**: `RecipeDTO`, `PaginationDTO`, `RecipeListResponseDTO`
- **Command Models**: A new `GetRecipesQuery` type will be created based on a Zod schema to represent the validated query parameters passed to the service layer.

## 4. Response Details
- **Success (200 OK)**:
  - Returns a `RecipeListResponseDTO` object containing the list of recipes and pagination details.
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "title": "string",
        "servings": 4,
        "macros": { "kcal": 450.0, "protein": 30.0, "carbs": 55.0, "fat": 12.0 },
        "recipeText": "string",
        "lastAdaptationExplanation": "string|null",
        "createdAt": "ISO-8601",
        "updatedAt": "ISO-8601"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "totalItems": 23,
      "totalPages": 3
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: When query parameters are invalid.
  - `401 Unauthorized`: When the user is not authenticated.
  - `500 Internal Server Error`: For unexpected server-side issues.

## 5. Data Flow
1. A `GET` request is made to `/api/recipes` with optional query parameters.
2. The Astro middleware (`src/middleware/index.ts`) verifies the user's authentication status from the session cookie. If the user is not authenticated, it returns a `401 Unauthorized` error.
3. The API route handler in `src/pages/api/recipes.ts` receives the request.
4. A `zod` schema is used to parse and validate the query parameters from the request URL. If validation fails, a `400 Bad Request` response is sent with details of the validation errors.
5. The validated query parameters (as a `GetRecipesQuery` object) and the authenticated `user_id` (from `context.locals.user.id`) are passed to the `getRecipes` function in `src/lib/services/recipe.service.ts`.
6. The `recipe.service` constructs a Supabase query to the `recipes` table.
   - It applies a `user_id` filter to ensure data isolation.
   - It dynamically adds `ilike` filters for the `search` parameter on `title` and `recipe_text`.
   - It adds `.gte()` and `.lte()` filters for the macronutrient ranges (`minKcal`, `maxKcal`, `minProtein`, `maxProtein`).
   - It applies sorting using `.order()` based on `sortBy` and `sortOrder`.
   - It calculates the `offset` and `limit` for pagination based on `page` and `pageSize`.
7. Two queries are executed concurrently: one to fetch the total count of matching items and another to fetch the paginated data.
8. The service transforms the database rows into `RecipeDTO` format and calculates pagination details (`totalPages`, etc.).
9. The service returns a `RecipeListResponseDTO` object to the API route handler.
10. The handler sends the DTO as a JSON response with a `200 OK` status code.

## 6. Security Considerations
- **Authentication**: Access is restricted to authenticated users. The middleware will reject requests without a valid session.
- **Authorization**: The service layer query must enforce data ownership by strictly filtering recipes by the `user_id` obtained from the session context (`context.locals.user.id`). This prevents users from accessing other users' data.
- **Input Validation**: All query parameters will be strictly validated using a `zod` schema to prevent invalid data from affecting the query logic and to protect against potential injection attacks, even with the ORM's protection.
- **SQL Injection**: The Supabase client library will be used to build queries, which automatically parameterizes inputs and mitigates the risk of SQL injection.

## 7. Error Handling
- **400 Bad Request**: The `zod` schema will catch any invalid or out-of-range query parameters. The API handler will return a structured JSON error response detailing the validation issues.
- **401 Unauthorized**: Handled by the Astro middleware if the user session is missing or invalid.
- **500 Internal Server Error**: A `try...catch` block in both the API handler and the service layer will catch unexpected errors (e.g., database connection failure). The error will be logged to the console, and a generic "Internal Server Error" message will be returned to the client.

## 8. Performance Considerations
- **Database Indexing**: Ensure that the `recipes(user_id)` column is indexed to speed up the primary filtering step. Consider adding indexes to columns used for sorting (`created_at`, `updated_at`, `title`) and filtering (`kcal`, `protein`) if performance analysis indicates they are necessary.
- **Pagination**: Limiting `pageSize` to a maximum of 50 prevents clients from requesting large datasets that could strain the database and network.
- **Query Optimization**: The total item count and the paginated data will be fetched in separate, optimized queries. The count query (`.select('*', { count: 'exact', head: true })`) is lightweight and avoids retrieving full data rows.

## 9. Implementation Steps
1.  **Create Zod Schema**: In `src/types.ts`, define a `zod` schema `GetRecipesQuerySchema` to validate the optional query parameters (`page`, `pageSize`, `search`, `sortBy`, `sortOrder`, and macro filters). Derive the `GetRecipesQuery` type from this schema.
2.  **Develop Service Layer**:
    - Create a new file `src/lib/services/recipe.service.ts`.
    - Implement a `getRecipes` function that accepts `GetRecipesQuery` and `userId` as arguments.
    - Inside this function, construct and execute the Supabase query to fetch the total count and the paginated list of recipes, applying all filters and sorting logic.
    - Map the database results to the `RecipeListResponseDTO` structure.
3.  **Implement API Route Handler**:
    - Create a new file `src/pages/api/recipes.ts`.
    - Add `export const prerender = false;`.
    - Implement the `GET` handler function which receives the `APIContext`.
    - Use `context.locals.user` to get the authenticated user's ID.
    - Parse the URL query parameters using the `GetRecipesQuerySchema`. Handle validation errors by returning a `400` response.
    - Call the `getRecipes` service function with the validated query and user ID.
    - Return the result from the service as a JSON response with a `200 OK` status.
    - Wrap the logic in a `try...catch` block to handle unexpected errors and return a `500` response.
4.  **Add Database Indexes (Migration)**:
    - Create a new Supabase migration file.
    - Add an index on `recipes(user_id)`.
    - Consider composite indexes if performance testing shows benefits, e.g., on `(user_id, updated_at)`.
