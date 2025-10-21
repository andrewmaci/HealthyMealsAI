# REST API Plan

## 1. Resources
- **Profile** → `profiles` (Supabase schema). One-to-one with `auth.users`; stores dietary preferences (`allergens`, `disliked_ingredients`), `timezone`, and timestamps via `set_updated_at` trigger.
- **Recipe** → `recipes`. User-owned recipes with nutritional macros, text content, adaptation explanation, audit timestamps, enforced via RLS (`user_id = auth.uid()`).
- **AdaptationLog** → `adaptation_logs`. Records each adaptation attempt per user and optionally recipe; supports quota tracking and history (indexed on `user_id`, `(user_id, created_at DESC)`).
- **Quota** → Computed resource (no table). Calculates remaining daily adaptations (limit 10) using logs and user timezone.
- **Authentication Session** → `auth.users` (Supabase-managed). API consumes authenticated context via Astro middleware (`locals.supabase`).

## 2. Endpoints

### Profile
- **GET /api/profile**
  - Description: Retrieve the authenticated user’s profile; auto-provision default row if missing.
  - Query params: none.
  - Request body: none.
  - Response body:
    ```json
    {
      "data": {
        "id": "uuid",
        "allergens": ["string"],
        "dislikedIngredients": ["string"],
        "timezone": "Europe/Warsaw",
        "createdAt": "ISO-8601",
        "updatedAt": "ISO-8601"
      }
    }
    ```
  - Success: 200 OK.
  - Errors: 401 Unauthorized; 500 Internal Server Error (profile lookup/provision failure).

- **PUT /api/profile**
  - Description: Update allergens, disliked ingredients, and timezone.
  - Query params: none.
  - Request body:
    ```json
    {
      "allergens": ["string"],
      "dislikedIngredients": ["string"],
      "timezone": "Continent/City or null"
    }
    ```
  - Response body: Same as GET.
  - Success: 200 OK; emits `profile_updated` analytics event with timezone metadata.
  - Errors: 400 Bad Request (invalid arrays/timezone); 401 Unauthorized; 409 Conflict (`If-Unmodified-Since` mismatch); 500 Internal Server Error.

### Recipes
- **GET /api/recipes**
  - Description: List current user’s recipes with pagination, filtering, and sorting.
  - Query params: `page` (int ≥1, default 1); `pageSize` (int 1–50, default 10); `search` (string; title/text ilike); `sortBy` (`created_at` | `updated_at` | `title`, default `updated_at`); `sortOrder` (`asc` | `desc`, default `desc`); `minKcal`, `maxKcal`, `minProtein`, `maxProtein` (numbers for macro range filters).
  - Request body: none.
  - Response body:
    ```json
    {
      "data": [
        {
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
  - Success: 200 OK.
  - Errors: 400 Bad Request (invalid pagination/filter); 401 Unauthorized; 500 Internal Server Error.

- **POST /api/recipes**
  - Description: Create a new recipe owned by the authenticated user.
  - Query params: none.
  - Request body:
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
  - Response body: Created recipe object.
  - Success: 201 Created; emits `recipe_created` event.
  - Errors: 400 Bad Request (validation failure); 401 Unauthorized; 422 Unprocessable Entity (numeric precision); 500 Internal Server Error.

- **GET /api/recipes/{id}**
  - Description: Retrieve a specific recipe owned by the user.
  - Query params: none.
  - Request body: none.
  - Response body: Recipe object.
  - Success: 200 OK.
  - Errors: 401 Unauthorized; 404 Not Found (nonexistent or not owned); 500 Internal Server Error.

- **PUT /api/recipes/{id}**
  - Description: Update recipe fields (partial updates allowed).
  - Query params: optional `return=minimal|full` (default `full`).
  - Request body: Same schema as POST; omit fields to leave unchanged.
  - Response body: Updated recipe, or `{ "data": { "id": "uuid", "updatedAt": "ISO-8601" } }` when `return=minimal`.
  - Success: 200 OK.
  - Errors: 400 Bad Request; 401 Unauthorized; 404 Not Found; 409 Conflict (optimistic concurrency using `If-Unmodified-Since`/ETag); 500 Internal Server Error.

- **DELETE /api/recipes/{id}**
  - Description: Permanently delete recipe (cascade clears related adaptation logs via FK).
  - Query params: optional `confirm=true` to enforce client confirmation.
  - Request body: optional `{ "confirmation": true }` for symmetry with UI modal.
  - Response body: none.
  - Success: 204 No Content.
  - Errors: 401 Unauthorized; 404 Not Found; 409 Conflict (guard against pending operations); 500 Internal Server Error.

### Adaptations
- **POST /api/recipes/{id}/adaptations**
  - Description: Initiate AI adaptation; enforces daily quota, records log, returns proposal without persisting recipe changes.
  - Headers: optional `Idempotency-Key` (≤64 chars) to deduplicate within short TTL (e.g., 5 minutes).
  - Query params: none.
  - Request body:
    ```json
    {
      "goal": "remove_allergens" | "remove_disliked_ingredients" | "reduce_calories" | "increase_protein",
      "notes": "string up to 500 characters"
    }
    ```
  - Response body (success):
    ```json
    {
      "data": {
        "logId": "uuid",
        "goal": "increase_protein",
        "proposedRecipe": {
          "recipeText": "string",
          "macros": {
            "kcal": 420.0,
            "protein": 38.0,
            "carbs": 40.0,
            "fat": 10.0
          }
        },
        "explanation": "string",
        "quota": {
          "limit": 10,
          "remaining": 9,
          "resetsAt": "ISO-8601"
        },
        "requestMetadata": {
          "requestedAt": "ISO-8601",
          "notes": "string|null",
          "disclaimer": "This adaptation is not medical advice. Verify ingredients before use."
        }
      }
    }
    ```
  - Success codes: 200 OK (proposal available; emit `ai_requested` then `ai_succeeded`); 202 Accepted (AI still processing; response includes `{ "data": { "status": "pending" } }`).
  - Errors: 400 Bad Request (invalid goal/notes/idempotency mismatch); 401 Unauthorized; 403 Forbidden (daily quota exhausted); 409 Conflict (duplicate in-flight adaptation for same recipe); 422 Unprocessable Entity (AI response invalid; quota not decremented); 429 Too Many Requests (rate limit); 500 Internal Server Error (OpenRouter failure, DB error).

- **POST /api/recipes/{id}/adaptations/accept**
  - Description: Persist accepted adaptation by overwriting recipe content/macros and storing explanation.
  - Query params: none.
  - Request body:
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
  - Response body: Updated recipe with new macros/text.
  - Success: 200 OK; emits `ai_accepted` event; notes that overwrite is irreversible per PRD.
  - Errors: 400 Bad Request (validation failure); 401 Unauthorized; 404 Not Found (recipe or `logId` not linked to user); 409 Conflict (optimistic concurrency); 422 Unprocessable Entity (numeric precision); 500 Internal Server Error.

- **GET /api/recipes/{id}/adaptations**
  - Description: Fetch paginated adaptation history for the recipe from `adaptation_logs`.
  - Query params: `page` (int ≥1, default 1); `pageSize` (int 1–50, default 10); `start`, `end` (ISO timestamps to filter `created_at`); `sortOrder` (`asc` | `desc`, default `desc`).
  - Request body: none.
  - Response body:
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
  - Success: 200 OK.
  - Errors: 401 Unauthorized; 404 Not Found; 500 Internal Server Error.

### Quota
- **GET /api/adaptations/quota**
  - Description: Return remaining daily adaptation quota using timezone-aware window.
  - Query params: none.
  - Request body: none.
  - Response body:
    ```json
    {
      "data": {
        "limit": 10,
        "used": 1,
        "remaining": 9,
        "windowStart": "ISO-8601",
        "windowEnd": "ISO-8601",
        "timezone": "Europe/Warsaw"
      }
    }
    ```
  - Success: 200 OK.
  - Errors: 401 Unauthorized; 500 Internal Server Error (unable to compute due to missing timezone or DB error).

### Authentication Helper (optional)
- **POST /api/auth/logout**
  - Description: Proxy to Supabase `signOut()` to clear HttpOnly session cookie.
  - Query params: none.
  - Request body: none.
  - Response body: none.
  - Success: 204 No Content.
  - Errors: 401 Unauthorized (no active session); 500 Internal Server Error.

### Utility
- **GET /api/health**
  - Description: Lightweight health check for infrastructure monitoring.
  - Query params: none.
  - Request body: none.
  - Response body: `{ "data": { "status": "ok", "timestamp": "ISO-8601" } }`.
  - Success: 200 OK.
  - Errors: 503 Service Unavailable (degraded dependency).

## 3. Authentication and Authorization
- **Authentication**: Supabase Auth with HttpOnly cookies. Astro middleware populates `locals.supabase`; each endpoint calls `supabase.auth.getUser()` to verify session. Unauthenticated requests return 401.
- **Authorization**: Database row-level security ensures access limited to `auth.uid()`. API never accepts `userId` from clients; server populates `user_id` during inserts/updates.
- **Service role usage**: For AI operations requiring elevated access (e.g., inserting adaptation logs), use server-side Supabase client while still filtering on `auth.uid()`.
- **Rate limiting**: Apply middleware (Redis/Upstash) to enforce per-user and per-IP ceilings (e.g., 60 req/min general, 10 req/min on adaptation initiation). Return 429 with `Retry-After` when exceeded.
- **Transport security**: Require HTTPS; configure CORS allowlist matching Astro front-end domain; enforce SameSite=Lax cookies to mitigate CSRF.
- **Secrets**: Keep OpenRouter API key server-side; never expose to client. Sanitize prompt inputs to avoid injection of allergens/dislikes.

## 4. Validation and Business Logic
- **Global validation**: Use Zod schemas mirroring DB constraints. Standardize response timestamps as ISO-8601 UTC. Error responses follow `{ "error": { "code": "string", "message": "string", "details": { ... } } }`.
- **Profiles**:
  - `allergens` / `dislikedIngredients`: arrays default to `[]`, must not contain null/empty strings; trim and deduplicate case-insensitively; optional cap (≤50 items) to prevent abuse.
  - `timezone`: null or valid IANA identifier; fallback to UTC if unset for quota calculations.
  - On success, fire-and-forget `profile_updated` analytics event with UTC timestamp and user timezone.
- **Recipes**:
  - `title`: trimmed length ≥1 (enforce API max 200 chars to complement DB check).
  - `servings`: positive integer.
  - Macros (`kcal`, `protein`, `carbs`, `fat`): numeric ≥0, ≤99999999.99 to respect `numeric(10,2)`; round to two decimals before persist.
  - `recipeText`: 1–10,000 characters; client receives remaining char count via UI.
  - `lastAdaptationExplanation`: optional, ≤2000 characters.
  - Automatically set `user_id` to `auth.uid()`. Update responses include `updatedAt` reflecting trigger-managed timestamp. Emit `recipe_created` on POST; optionally emit analytics for update/delete if needed later.
- **Adaptations**:
  - Enforce goal enum and notes ≤500 characters (PRD). Strip HTML, sanitize to prevent prompt injection. Include strict AI prompt instructing avoidance of allergens/dislikes.
  - Before invoking AI: verify recipe ownership, compute daily usage (successful adaptations since user-local midnight) using stored timezone (default UTC), and deny if remaining ≤0.
  - Insert `adaptation_logs` row (ties to user/recipe) and emit `ai_requested` event.
  - Call OpenRouter; validate JSON response against schema `{ recipeText, macros:{kcal,protein,carbs,fat}, explanation }`. Reject invalid responses with 422; log failure; do not decrement quota.
  - On success: emit `ai_succeeded`; return payload including disclaimer. Cache response keyed by `Idempotency-Key`+user+recipe to prevent duplicates.
  - Acceptance endpoint validates `logId` belongs to user and corresponds to same recipe; ensure `recipeText` & macros meet same constraints as recipe updates; update `recipes` within transaction and set `last_adaptation_explanation`. Emit `ai_accepted` event.
  - Prevent double acceptance by marking `logId` as consumed (cache or additional column) before commit.
- **Quota**:
  - Determine local midnight using profile timezone; convert to UTC to query `adaptation_logs` (optionally join analytics store for success status). Return `windowStart`, `windowEnd`, `remaining`, and timezone. Cache responses for short TTL (e.g., 30 seconds) to reduce repeated computation.
- **Analytics & Logging**:
  - Centralize through `src/lib/analytics.ts`; non-blocking emission with fallback logging on failure. Include event type, UTC timestamp, user timezone, recipe/adaptation IDs.
  - Log adaptation errors (AI timeout, schema issues) with structured metadata for observability.
- **Safety & UX**:
  - Include disclaimer string in adaptation responses to satisfy PRD requirement for persistent notice. Ensure frontend displays and keeps static notice for accepted/adapted recipes.
  - Combine frontend duplicate-submission guard with backend idempotency to guarantee single processing per request.
- **Performance**:
  - Use indexed queries filtering by `user_id` and ordering by `created_at`/`updated_at` to leverage `recipes_user_id_idx` and `adaptation_logs_user_id_created_at_idx`.
  - Paginate list endpoints; default `pageSize` 10 and max 50 to avoid large payloads.
  - For long-running AI calls, allow optional asynchronous mode (202) with polling or websocket upgrade in future iteration.
