# API Endpoint Implementation Plan: GET /api/adaptations/quota

## 1. Endpoint Overview
This endpoint provides information about the user's daily recipe adaptation quota. It calculates the number of adaptations used within the current day, based on the user's specific timezone, and returns the limit, usage, and remaining balance.

## 2. Request Details
- **HTTP Method:** `GET`
- **URL Structure:** `/api/adaptations/quota`
- **Parameters:** None.
- **Request Body:** None.

## 3. Used Types
- **Successful Response DTO:** `AdaptationQuotaResponseDTO`

## 4. Response Details
- **Success (200 OK):** Returns the user's current quota status.
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
- **Error Responses:** See Error Handling section.

## 5. Data Flow
1. The API route receives the `GET` request. The user must be authenticated.
2. The route handler calls a method in the `AdaptationService` to retrieve the quota information for the authenticated user.
3. **AdaptationService Logic (`getAdaptationQuota`):**
   a. **Fetch User Profile:** The service retrieves the user's profile from the `profiles` table to get their configured `timezone`. If the timezone is not set, it defaults to `UTC`.
   b. **Calculate Time Window:** Using the user's timezone, the service calculates the start and end of the current day (e.g., from midnight to 23:59:59.999). These timestamps are converted to UTC for the database query.
   c. **Database Query:** The service queries the `adaptation_logs` table to count the number of records for the `user_id` where `created_at` falls within the calculated time window.
   d. **Read Limit:** The daily adaptation limit is read from an environment variable (e.g., `DAILY_ADAPTATION_LIMIT`).
   e. **Assemble DTO:** The service constructs the `AdaptationQuotaDTO` with the limit, the count of used adaptations, the calculated remaining balance, the start and end of the window in ISO 8601 format, and the timezone used for the calculation.
4. The API route receives the `AdaptationQuotaDTO` from the service.
5. It wraps the DTO in a `StandardResponse` (`AdaptationQuotaResponseDTO`) and sends the JSON response with a 200 OK status code.

## 6. Security Considerations
- **Authentication:** This endpoint must be protected. Unauthenticated users should receive a 401 Unauthorized error. The logic should be securely tied to the `user_id` from the active session.

## 7. Error Handling
- **401 Unauthorized:** The user is not authenticated.
- **500 Internal Server Error:** An unexpected error occurs, such as:
  - Failure to fetch the user's profile from the database.
  - Failure to query the `adaptation_logs` table.
  - The timezone identifier in the user's profile is invalid (though this should be prevented by validation during profile updates).

## 8. Performance Considerations
- The query to count adaptations is the main operation. To ensure it is fast, an index should exist on `adaptation_logs` for `(user_id, created_at)`.
- The overall performance should be excellent as it involves only two small database reads.

## 9. Implementation Steps
1. **Update `AdaptationService`:**
   - The `getAdaptationQuota(userId)` method, likely created for the `POST /adaptations` endpoint, will be used here.
   - Ensure its implementation correctly handles fetching the user's timezone, calculating the daily window, and querying the database as described in the Data Flow section.
   - The method should return a complete `AdaptationQuotaDTO`.
2. **Implement API Endpoint:**
   - Create a new file `src/pages/api/adaptations/quota.ts`.
   - Add `export const prerender = false;`
   - Implement the `GET` handler.
   - Use `Astro.locals.supabase` to get the current user session and `user_id`.
   - Call the `adaptationService.getAdaptationQuota(userId)` method.
   - Construct the `StandardResponse` object with the data from the service.
   - Return the JSON response with a 200 OK status.
   - Implement error handling to catch potential service errors and return a 500 status code.
3. **Environment Variable:**
   - Ensure the `DAILY_ADAPTATION_LIMIT` is defined in the project's environment variables.
