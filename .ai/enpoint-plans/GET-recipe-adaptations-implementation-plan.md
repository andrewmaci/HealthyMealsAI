# API Endpoint Implementation Plan: GET /api/recipes/{id}/adaptations

## 1. Endpoint Overview
This endpoint provides a paginated history of all adaptation attempts for a specific recipe. It retrieves records from the `adaptation_logs` table, allowing clients to review past activities. The results can be filtered by a date range and sorted.

## 2. Request Details
- **HTTP Method:** `GET`
- **URL Structure:** `/api/recipes/{id}/adaptations`
- **Parameters:**
  - **Path:**
    - `id` (string, UUID format): The unique identifier of the recipe. **(Required)**
  - **Query:**
    - `page` (integer, min 1): The page number for pagination. Default: `1`. **(Optional)**
    - `pageSize` (integer, 1-50): The number of items per page. Default: `10`. **(Optional)**
    - `start` (string, ISO 8601): The start date of a time range filter for `created_at`. **(Optional)**
    - `end` (string, ISO 8601): The end date of a time range filter for `created_at`. **(Optional)**
    - `sortOrder` (`asc` | `desc`): The sort order for the results based on `created_at`. Default: `desc`. **(Optional)**

## 3. Used Types
- **Query Parameter Validation:** `GetRecipeAdaptationHistoryQuerySchema` (New Zod schema)
- **Service Layer Command:** `GetRecipeAdaptationHistoryQuery` (Type inferred from Zod schema)
- **Successful Response DTO:** `RecipeAdaptationHistoryResponseDTO`

## 4. Response Details
- **Success (200 OK):** Returns a paginated list of adaptation log entries.
  ```json
  {
    "data": [
      {
        "id": "uuid",
        "recipeId": "uuid",
        "createdAt": "ISO-8601"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "totalItems": 12,
      "totalPages": 2
    }
  }
  ```
- **Error Responses:** See Error Handling section.

## 5. Data Flow
1. The API route receives the `GET` request. The user must be authenticated.
2. The handler validates the `id` path parameter and the query parameters from the URL using a new Zod schema, `GetRecipeAdaptationHistoryQuerySchema`. This schema will apply defaults for `page`, `pageSize`, and `sortOrder`.
3. It calls the `AdaptationService` with the user's ID, recipe ID, and the validated query parameters object.
4. **AdaptationService Logic:**
   a. **Authorization:** The service first queries the `recipes` table to ensure that a recipe with the given `recipeId` exists and belongs to the authenticated `userId`. If not, it throws a 404 error.
   b. **Database Query:** The service constructs a Supabase query to fetch records from `adaptation_logs`.
      - It counts the total number of matching records to calculate pagination metadata.
      - It then fetches the paginated data.
   c. **Query Filtering:**
      - `WHERE recipe_id = :recipeId`
      - If `start` and `end` query parameters are provided, it adds a `created_at BETWEEN :start AND :end` clause.
   d. **Query Sorting:**
      - Applies an `ORDER BY created_at` clause with the specified `sortOrder`.
   e. **Query Pagination:**
      - Uses Supabase's `.range()` method to apply pagination based on `page` and `pageSize`.
   f. **Response Assembly:** The service maps the database rows to `RecipeAdaptationHistoryItemDTO` objects and constructs the final `RecipeAdaptationHistoryResponseDTO`, including the list of items and the pagination details.
5. The API route receives the DTO from the service and sends the JSON response with a 200 OK status code.

## 6. Security Considerations
- **Authentication:** All requests must be authenticated.
- **Authorization:** It is crucial to verify that the user owns the recipe (`recipeId`) before fetching its adaptation history. This prevents users from discovering information about other users' recipes or activities.
- **Input Validation:** Query parameters must be validated to ensure they are of the correct type and within acceptable ranges (`pageSize`) to prevent overly large or malformed database queries.

## 7. Error Handling
- **400 Bad Request:** Query parameters fail validation (e.g., `pageSize` is not a number or is out of range, `start`/`end` are not valid dates).
- **401 Unauthorized:** The user is not authenticated.
- **404 Not Found:** The requested recipe `id` does not exist or does not belong to the user.
- **500 Internal Server Error:** The database query fails for an unexpected reason.

## 8. Performance Considerations
- **Database Indexing:** To ensure efficient querying, an index should be created on the `adaptation_logs` table for the `(recipe_id, created_at)` columns.
- **Pagination:** Enforcing a maximum `pageSize` is important to prevent clients from requesting excessively large amounts of data in a single request, which could strain the database.

## 9. Implementation Steps
1. **Create new types:**
   - In `src/types.ts`, define `GetRecipeAdaptationHistoryQuerySchema` for validating the query parameters. Use Zod's `coerce` for numbers and add defaults and range checks.
2. **Update `AdaptationService`:**
   - In `src/lib/services/adaptation.service.ts`, implement a new method `getAdaptationHistory(userId, recipeId, query)`.
   - Implement the data flow logic: authorization check, building the Supabase query with filtering and pagination, and assembling the `RecipeAdaptationHistoryResponseDTO`.
3. **Implement API Endpoint:**
   - Create a new file `src/pages/api/recipes/[id]/adaptations/index.ts`.
   - Add `export const prerender = false;`
   - Implement the `GET` handler.
   - Use `Astro.locals.supabase` for the session.
   - Parse and validate the URL query parameters using the new Zod schema.
   - Call the `adaptationService.getAdaptationHistory` method.
   - Return the result from the service with a 200 OK status.
   - Implement error handling to map service errors to HTTP status codes.
