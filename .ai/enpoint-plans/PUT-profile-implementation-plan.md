# API Endpoint Implementation Plan: PUT /api/profile

## 1. Endpoint Overview
This document outlines the implementation plan for the `PUT /api/profile` endpoint. This endpoint allows authenticated users to update their profile information, including their list of allergens, disliked ingredients, and timezone. The endpoint incorporates an optimistic concurrency control mechanism to prevent data conflicts.

## 2. Request Details
-   **HTTP Method**: `PUT`
-   **URL Structure**: `/api/profile`
-   **Headers**:
    -   `Content-Type`: `application/json`
    -   `If-Unmodified-Since`: **Required**. An RFC 1123 formatted date string representing the `updated_at` timestamp of the profile when it was last fetched by the client. This is used for optimistic locking.
-   **Request Body**: A JSON object with the following structure:
    ```json
    {
      "allergens": ["string"],
      "dislikedIngredients": ["string"],
      "timezone": "Continent/City or null"
    }
    ```

## 3. Used Types

### `ProfileUpdateDto` (Zod Schema)
A new Zod schema will be created in `src/types.ts` (or a dedicated validation file) to validate the request body.

```typescript
import { z } from "zod";

// A helper function to validate IANA timezone identifiers.
const isValidTimezone = (tz: string) => {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (ex) {
    return false;
  }
};

export const ProfileUpdateDtoSchema = z.object({
  allergens: z.array(z.string().min(1, "Allergen strings cannot be empty.")),
  dislikedIngredients: z.array(z.string().min(1, "Ingredient strings cannot be empty.")),
  timezone: z.string().refine(isValidTimezone, {
    message: "Invalid timezone identifier.",
  }).nullable(),
});

export type ProfileUpdateDto = z.infer<typeof ProfileUpdateDtoSchema>;
```

### `ProfileDTO` (Existing)
The existing `ProfileDTO` from `src/types.ts` will be used for the response payload.

## 4. Response Details
-   **Success (200 OK)**: Returns the complete, updated profile object.
    -   Body: `ProfileResponseDTO`
    ```json
    {
      "data": {
        "id": "uuid",
        "allergens": ["Peanuts", "Shellfish"],
        "dislikedIngredients": ["Onions"],
        "timezone": "Europe/London",
        "createdAt": "iso-timestamp",
        "updatedAt": "iso-timestamp"
      }
    }
    ```
-   **Error Responses**:
    -   `400 Bad Request`: If request body validation fails or `If-Unmodified-Since` header is missing/invalid.
    -   `401 Unauthorized`: If the user is not authenticated.
    -   `409 Conflict`: If the `If-Unmodified-Since` timestamp does not match the current `updated_at` value in the database.
    -   `500 Internal Server Error`: For unexpected server-side errors.

## 5. Data Flow
1.  A `PUT` request is sent to `/api/profile`.
2.  Astro's middleware authenticates the user and attaches the session and Supabase client to `Astro.locals`.
3.  The `PUT` handler in `src/pages/api/profile.ts` is invoked.
4.  The handler first validates the presence and format of the `If-Unmodified-Since` header.
5.  It then parses and validates the request body against the `ProfileUpdateDtoSchema` Zod schema.
6.  If validation passes, the handler calls a new `updateProfile` function in `src/lib/services/profile.service.ts`, passing the user ID, the validated DTO, and the `If-Unmodified-Since` value.
7.  The `updateProfile` service function executes a single `UPDATE` query on the `profiles` table using the Supabase client. The query includes a `WHERE` clause to match both the `id` and the `updated_at` timestamp (to enforce optimistic locking).
8.  The service checks the result of the update query. If no rows were affected, it signifies a timestamp mismatch, and a "Conflict" error is thrown.
9.  If the update is successful, the service returns the updated profile data.
10. The API handler catches any errors and maps them to the appropriate HTTP status codes (400, 409, 500).
11. On success, the handler sends a `200 OK` response with the updated profile DTO and emits a `profile_updated` analytics event.

## 6. Security Considerations
-   **Authentication**: Access is restricted to authenticated users. The handler must reject any request without a valid user session in `Astro.locals`.
-   **Authorization**: All database operations are scoped to the authenticated user's ID, preventing users from modifying other users' profiles.
-   **Input Validation**: Strict validation with Zod on the request body and validation of the `If-Unmodified-Since` header are mandatory to prevent malformed data and potential injection attacks.
-   **Concurrency Control**: The use of the `If-Unmodified-Since` header and a conditional `UPDATE` statement is critical to prevent race conditions and lost updates.

## 7. Performance Considerations
-   The operation involves a single indexed `UPDATE` on the `profiles` table (`id` is the primary key). This is a highly efficient operation and is not expected to cause performance issues.
-   Timezone validation using `Intl.DateTimeFormat` is fast and will not be a bottleneck.

## 8. Implementation Steps
1.  **Update Types**:
    -   Add the `ProfileUpdateDtoSchema` Zod schema and its inferred type `ProfileUpdateDto` to `src/types.ts`.

2.  **Create Service Function**:
    -   In `src/lib/services/profile.service.ts`, create a new async function `updateProfile`.
    -   **Parameters**: `(supabase: SupabaseClient, userId: string, data: ProfileUpdateDto, ifUnmodifiedSince: string)`
    -   **Logic**:
        -   Fetch the current profile to compare `updated_at` with `ifUnmodifiedSince`. Throw a custom `ProfileConflictError` if they do not match.
        -   Perform an `update` operation on the `profiles` table where `id` equals `userId`.
        -   Map the DTO fields (`dislikedIngredients`) to the correct database column names (`disliked_ingredients`).
        -   Use `.eq('id', userId)` and `.eq('updated_at', ifUnmodifiedSince)` in the Supabase query to ensure atomicity.
        -   Check the returned data from the update. If it's empty, it means the `updated_at` check failed, and a conflict error should be thrown.
        -   Handle potential database errors by wrapping the call in a `try...catch` block and throwing a `ProfileServiceError`.
        -   Return the updated profile data, mapped to `ProfileDTO`.

3.  **Implement API Route Handler**:
    -   In `src/pages/api/profile.ts`, export a new `PUT: APIRoute` async function.
    -   **Logic**:
        -   Check for an authenticated user via `locals.session.user`. Return `401 Unauthorized` if not present.
        -   Retrieve and validate the `If-Unmodified-Since` header. Return `400 Bad Request` if missing or invalid.
        -   Parse the JSON request body.
        -   Validate the body using `ProfileUpdateDtoSchema.safeParse()`. On failure, return a `400 Bad Request` with validation error details.
        -   Call `profileService.updateProfile()` with the required arguments.
        -   Use a `try...catch` block to handle errors from the service:
            -   Catch `ProfileConflictError` -> return `409 Conflict`.
            -   Catch `ProfileServiceError` -> return `500 Internal Server Error`.
            -   Catch Zod validation errors -> return `400 Bad Request`.
            -   Catch any other unexpected errors -> return `500 Internal Server Error`.
        -   On success, construct the `ProfileResponseDTO` and return a `200 OK` response.
        -   (Optional) Implement analytics event emission for `profile_updated`.
