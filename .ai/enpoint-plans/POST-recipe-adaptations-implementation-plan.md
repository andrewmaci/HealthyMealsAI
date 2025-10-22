# API Endpoint Implementation Plan: POST /api/recipes/{id}/adaptations

## 1. Endpoint Overview
This endpoint initiates an AI-powered adaptation for a specific recipe. It validates the user's request, checks against a daily adaptation quota, logs the attempt, and calls an external AI service to generate a recipe proposal. The endpoint returns the AI-generated proposal without persisting changes to the original recipe, allowing the user to review it before acceptance. It supports idempotency to prevent duplicate requests.

## 2. Request Details
- **HTTP Method:** `POST`
- **URL Structure:** `/api/recipes/{id}/adaptations`
- **Parameters:**
  - **Path:**
    - `id` (string, UUID format): The unique identifier of the recipe to adapt. **(Required)**
  - **Headers:**
    - `Idempotency-Key` (string, max 64 chars): A unique key to prevent duplicate processing of the same request. **(Optional)**
- **Request Body:**
  ```json
  {
    "goal": "remove_allergens" | "remove_disliked_ingredients" | "reduce_calories" | "increase_protein",
    "notes": "string"
  }
  ```
  - `goal`: The primary objective of the adaptation. **(Required)**
  - `notes`: User-provided notes to guide the AI, max 500 characters. **(Optional)**

## 3. Used Types
- **Request Body Validation:** `RecipeAdaptationRequestDtoSchema` (New Zod schema)
- **Service Layer Command:** `RecipeAdaptationRequestCommand`
- **Successful Response DTO:** `RecipeAdaptationProposalResponseDTO`
- **Pending Response DTO:** `AdaptationPendingResponseDTO` (New DTO)

## 4. Response Details
- **Success (200 OK):** Returns the complete adaptation proposal.
  ```json
  {
    "data": {
      "logId": "uuid",
      "goal": "...",
      "proposedRecipe": { ... },
      "explanation": "...",
      "quota": { ... },
      "requestMetadata": { ... }
    }
  }
  ```
- **Success (202 Accepted):** Returned if AI processing is taking longer than expected.
  ```json
  { "data": { "status": "pending" } }
  ```
- **Error Responses:** See Error Handling section.

## 5. Data Flow
1. The API route receives the `POST` request. The user must be authenticated.
2. The route handler validates the recipe `id` from the path and the request body using a new Zod schema, `RecipeAdaptationRequestDtoSchema`.
3. It calls the `AdaptationService` with the user's ID, recipe ID, and the validated request body DTO.
4. **AdaptationService Logic:**
   a. **Authorization:** Fetches the specified recipe, ensuring it belongs to the authenticated user. If not found, throws a 404 error.
   b. **Quota Check:** Calculates the user's current adaptation usage for the day (respecting the user's profile timezone) and compares it against the daily limit. If the quota is exceeded, throws a 403 error.
   c. **Idempotency (Optional):** If an `Idempotency-Key` is provided, the service checks a cache (e.g., Redis or a temporary database table) for an existing request with the same key. If found, it returns the cached response.
   d. **Logging:** Creates a new record in the `adaptation_logs` table, linking `user_id` and `recipe_id`. The ID of this new log entry (`logId`) is retained.
   e. **AI Interaction:** Constructs a detailed prompt for the AI service (e.g., OpenRouter). The prompt includes the original recipe text, user profile data (allergens, disliked ingredients), and the adaptation `goal` and `notes`.
   f. **Proposal Generation:** Sends the prompt to the AI service and awaits the response.
   g. **Response Parsing:** Validates the AI's response to ensure it conforms to the expected structure (recipe text, macros, explanation). If validation fails, it throws a 422 error and the adaptation log should be deleted or marked as failed to avoid consuming quota.
   h. **Response Assembly:** Constructs the `RecipeAdaptationProposalDTO` using the `logId`, AI-generated content, and updated quota information.
   i. **Caching:** If using idempotency, stores the successful response in the cache with the `Idempotency-Key`.
5. The API route receives the DTO from the service and sends the JSON response with the appropriate status code (200).

## 6. Security Considerations
- **Authentication:** All requests must be authenticated. The Astro middleware will handle session verification.
- **Authorization:** The `AdaptationService` must verify that the `recipe_id` belongs to the `user_id` from the authenticated session to prevent users from accessing or adapting others' recipes.
- **Input Validation:** The request body must be strictly validated using Zod to prevent invalid data and potential injection attacks, especially in the `notes` field which is passed to the AI.
- **Rate Limiting:** Implement rate limiting on the endpoint to prevent abuse of the computationally expensive AI service.
- **Quota Management:** The daily quota is a critical defense against resource exhaustion and must be enforced reliably.

## 7. Error Handling
- **400 Bad Request:** Invalid UUID format for recipe `id`, request body fails Zod validation (e.g., invalid `goal`, `notes` too long), or `Idempotency-Key` is invalid/mismatched.
- **401 Unauthorized:** The user is not authenticated.
- **403 Forbidden:** The user has exhausted their daily adaptation quota.
- **404 Not Found:** The requested recipe `id` does not exist or does not belong to the user.
- **409 Conflict:** An adaptation for the same recipe is already in progress.
- **422 Unprocessable Entity:** The response from the AI service is malformed or invalid. The user's quota should not be decremented.
- **429 Too Many Requests:** The user has exceeded the rate limit for the endpoint.
- **500 Internal Server Error:** An unexpected error occurred, such as failure to connect to the database or the AI service being unavailable.

## 8. Performance Considerations
- **AI Service Latency:** The primary bottleneck will be the response time from the external AI service. The API should handle this by either setting a reasonable timeout or returning a `202 Accepted` response for long-polling, as specified.
- **Database Queries:** All database queries should be optimized. Ensure proper indexing on `recipes(user_id)` and `adaptation_logs(user_id, created_at)`.

## 9. Implementation Steps
1. **Create new types:**
   - In `src/types.ts`, define `RecipeAdaptationRequestDtoSchema` for validating the request body.
   - Define `AdaptationPendingDTO` and `AdaptationPendingResponseDTO` for the 202 response.
2. **Develop `AdaptationService`:**
   - Create a new file `src/lib/services/adaptation.service.ts`.
   - Implement a method `proposeAdaptation(userId, recipeId, command)`.
   - Inside this method, implement the full data flow logic: authorization, quota check, DB logging, AI interaction, and response assembly.
   - Add a helper method for checking the quota, `getAdaptationQuota(userId)`.
3. **Implement API Endpoint:**
   - Create a new file `src/pages/api/recipes/[id]/adaptations.ts`.
   - Add `export const prerender = false;`
   - Implement the `POST` handler.
   - Use `Astro.locals.supabase` for DB access and to get the current user session.
   - Perform input validation using the new Zod schema.
   - Call the `AdaptationService` to handle the business logic.
   - Format the service's return value into a JSON response with the correct status code.
   - Implement comprehensive error handling using a try-catch block, mapping service errors to appropriate HTTP status codes.
4. **Environment Variables:**
   - Add environment variables for the AI service API key (`OPENROUTER_API_KEY`) and the daily adaptation limit (`DAILY_ADAPTATION_LIMIT`).
