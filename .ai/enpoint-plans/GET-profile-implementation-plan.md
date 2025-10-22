# API Endpoint Implementation Plan: GET /api/profile

## 1. Endpoint Overview
Retrieve the authenticated user’s profile. If no profile exists for the authenticated user, create a default row and return it.

## 2. Request Details
- HTTP Method: GET
- URL Structure: /api/profile
- Parameters:
  - Required: none
  - Optional: none
- Request Body: none

## 3. Used Types
- `ProfileDTO` for serialized profile data (`src/types.ts`).
- `ProfileResponseDTO` as the response wrapper (`src/types.ts`).
- Internal helper types: `ProfileRow` from Supabase generated types (`src/db/database.types.ts`).

## 4. Response Details
- Success 200: `{ "data": ProfileDTO }` with camelCase fields and timezone defaulted to `UTC` when null.
- Error 401: returned when no authenticated user context is available.
- Error 500: returned when Supabase query or auto-provisioning fails, or if profile remains unresolved.

## 5. Data Flow
Supabase-authenticated request → Astro API route (`src/pages/api/profile.ts`) → retrieve Supabase client from `locals.supabase` → invoke `getOrCreateProfile` service → map `ProfileRow` to `ProfileDTO` → return JSON response conforming to `ProfileResponseDTO`.

## 6. Security Considerations
- Require authenticated user via Astro locals (session/user). Return 401 if absent.
- Avoid accepting user identifiers from client; rely solely on session user ID.
- Ensure created profiles use the authenticated user ID to prevent privilege escalation.
- Do not leak Supabase error details; log internally and respond with generic messages.

## 7. Error Handling
- 401 when `locals.session?.user` is undefined.
- 500 when Supabase select or insert operations return an error or no row after provisioning.
- Log errors with contextual metadata (user ID, operation) using shared logging mechanism (e.g., `console.error` or future logger).

## 8. Performance Considerations
- Queries target a single row by primary key; expected to be O(1).
- Use `select().single()` to avoid unnecessary data retrieval.
- Cache is unnecessary due to low cost, but minimize repeated queries by only inserting when fetch returns null.

## 9. Implementation Steps
1. Create `src/lib/services/profile.service.ts` with `getOrCreateProfile` (encapsulate select/insert logic) and `mapProfileRowToDTO` helper.
2. Within service, use Supabase client passed from route, fetch profile via `from("profiles").select("*").eq("id", userId).maybeSingle()`.
3. If no profile, insert default row `{ id: userId }` with empty arrays and timestamp defaults, then re-fetch or use inserted row result; handle and log errors.
4. Ensure service normalizes `timezone` to `UTC` fallback when null.
5. Implement `src/pages/api/profile.ts` GET handler: set `export const prerender = false`, validate session, call service, map to DTO, return `Response.json` with 200 status.
6. Handle Supabase errors with try/catch, log via shared logger or `console.error`, and respond with 500.
8. Update any API documentation or Postman collections to include `/api/profile` endpoint details.
