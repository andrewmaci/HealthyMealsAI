# API Endpoint Implementation Plan: POST /api/recipes/{id}/adaptations/accept

## 1. Endpoint Overview
This endpoint allows a user to accept a previously generated AI recipe adaptation proposal. Upon acceptance, it permanently overwrites the content of the original recipe with the proposed text, macros, and explanation. The operation is idempotent based on the `logId`, but destructive to the original recipe data.

## 2. Request Details
- **HTTP Method:** `POST`
- **URL Structure:** `/api/recipes/{id}/adaptations/accept`
- **Parameters:**
  - **Path:**
    - `id` (string, UUID format): The unique identifier of the recipe to update. **(Required)**
- **Request Body:**
  ```json
  {
    "logId": "uuid",
    "recipeText": "string",
    "macros": {
      "kcal": 420.0,
      "protein": 38.0,
      "carbs": 40.0,
      "fat": 10.0
    },
    "explanation": "string"
  }
  ```
  - `logId`: The unique identifier of the adaptation log entry generated during the proposal step. **(Required)**
  - `recipeText`, `macros`, `explanation`: The new content to be persisted. **(Required)**

## 3. Used Types
- **Request Body Validation:** `RecipeAdaptationAcceptDtoSchema` (New Zod schema)
- **Service Layer Command:** `RecipeAdaptationAcceptCommand`
- **Successful Response DTO:** `RecipeResponseDTO`

## 4. Response Details
- **Success (200 OK):** Returns the full, updated recipe object.
  ```json
  {
    "data": {
      "id": "uuid",
      "title": "...",
      "servings": 2,
      "macros": { ... },
      "recipeText": "...",
      "lastAdaptationExplanation": "...",
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  }
  ```
- **Error Responses:** See Error Handling section.

## 5. Data Flow
1. The API route receives the `POST` request. The user must be authenticated.
2. The handler validates the `id` path parameter and the request body using a new Zod schema, `RecipeAdaptationAcceptDtoSchema`. This schema will reuse macro and text validation logic from existing schemas.
3. It calls the `AdaptationService` with the user's ID, recipe ID, and the validated request body DTO (`RecipeAdaptationAcceptCommand`).
4. **AdaptationService Logic:**
   a. **Authorization & Validation:** The service performs a single database query to join `recipes` and `adaptation_logs`. It validates that:
      - A recipe with the given `recipeId` exists.
      - An adaptation log with the given `logId` exists.
      - Both records belong to the authenticated `userId`.
      - The `logId` is associated with the `recipeId`.
      - If any check fails, a 404 error is thrown.
   b. **Concurrency Check:** An optimistic concurrency check can be implemented by comparing the `updated_at` timestamp of the recipe fetched from the database with a timestamp passed from the client (if available) or by simply ensuring the recipe hasn't been modified since the adaptation was proposed (if the proposal stores this). Since the spec doesn't provide for this, the update will proceed, but this is a potential enhancement.
   c. **Database Update:** The service updates the recipe record in the `recipes` table with the new `recipe_text`, macro values (`kcal`, `protein`, `carbs`, `fat`), and `last_adaptation_explanation`. The `updated_at` field is also updated automatically.
   d. **Log Update (Optional):** As an enhancement, the service could update the `adaptation_logs` record to mark its status as `accepted`. This is useful for analytics but not required by the current spec.
   e. **Return Updated Recipe:** The service fetches the newly updated recipe data and returns it as a `RecipeDTO`.
5. The API route receives the DTO from the service and sends the JSON response with a 200 OK status code.

## 6. Security Considerations
- **Authentication:** All requests must be authenticated via the Astro middleware.
- **Authorization:** This is critical. The service must ensure the user owns both the recipe being modified and the adaptation log being referenced. A query joining both tables on `user_id` is essential to prevent unauthorized overwrites.
- **Data Tampering:** The current design allows the user to send modified `recipeText` or `macros` that differ from what the AI originally proposed. While this provides flexibility, it means the persisted data isn't guaranteed to be the AI's output. This is an accepted design trade-off per the spec.
- **Input Validation:** All fields in the request body must be strictly validated for type, format, and length to maintain data integrity in the database.

## 7. Error Handling
- **400 Bad Request:** Request body fails Zod validation (e.g., missing fields, invalid macro values, text fields exceeding length limits).
- **401 Unauthorized:** The user is not authenticated.
- **404 Not Found:** The `recipeId` or `logId` does not exist, or they are not linked to the user's account.
- **409 Conflict:** An optimistic concurrency check fails, indicating the recipe was modified by another request after the adaptation was proposed.
- **422 Unprocessable Entity:** Macro values have incorrect numeric precision that the database rejects (should be caught by Zod validation).
- **500 Internal Server Error:** The database update operation fails for an unexpected reason.

## 8. Performance Considerations
- The operation involves a single read (for validation) and a single write (to update the recipe), so it should be highly performant.
- Ensure proper database indexing on `recipes(id, user_id)` and `adaptation_logs(id, user_id, recipe_id)`.

## 9. Implementation Steps
1. **Create new types:**
   - In `src/types.ts`, define `RecipeAdaptationAcceptDtoSchema` for validating the request body. It should enforce constraints on `recipeText` length, macro precision, and `explanation` length.
2. **Update `AdaptationService`:**
   - In `src/lib/services/adaptation.service.ts`, implement a new method `acceptAdaptation(userId, recipeId, command)`.
   - Implement the data flow logic described above, including the authorization check and the database update query.
   - The method should return the updated `RecipeDTO`.
3. **Implement API Endpoint:**
   - Create a new file `src/pages/api/recipes/[id]/adaptations/accept.ts`.
   - Add `export const prerender = false;`
   - Implement the `POST` handler.
   - Use `Astro.locals.supabase` for the session.
   - Validate the request body with the `RecipeAdaptationAcceptDtoSchema`.
   - Call the `adaptationService.acceptAdaptation` method.
   - Return the result from the service with a 200 OK status.
   - Implement error handling to map service errors to HTTP status codes.
