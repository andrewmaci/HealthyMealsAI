## View Implementation Plan – Profile Settings

## 1. Overview
The Profile Settings view at `/profile` lets users manage dietary preferences (allergens and disliked ingredients) and timezone. It fetches the current profile, displays editable lists via tag-based inputs, and a timezone selector populated with IANA identifiers. On save, it updates the profile via `PUT /api/profile` with optimistic concurrency using the `If-Unmodified-Since` header. A non-blocking completion prompt appears when preferences are empty. Success shows a toast; validation prevents invalid submissions. Accessibility and keyboard navigation are first-class.

## 2. View Routing
- Path: `/profile`
- File: `src/pages/profile.astro`
- Behavior:
  - Protected view. If `GET /api/profile` returns 401, show signed-out state with link to sign-in (or redirect depending on auth strategy). In current dev middleware a default session is injected, but plan for production 401.
  - Do not SSR user data in the page for now; fetch client-side to keep the page simple and reuse the same API contracts.

## 3. Component Structure
- `src/pages/profile.astro`
  - `ProfileSettings` (React, client:load)
    - `ProfileCompletionPrompt`
    - `ProfileForm`
      - `TagInput` (allergens)
      - `TagInput` (disliked ingredients)
      - `TimezoneSelect`
      - Form actions (Save, Reset/Cancel)
    - `Toast`/toaster provider (if implemented)

## 4. Component Details
### ProfileSettings
- Description: Container component orchestrating data fetching, error/loading states, and rendering `ProfileForm`. Owns API integration and concurrency headers.
- Main elements:
  - Wrapper `Card` with header, description
  - Loading skeleton or spinner
  - Error banner with Retry
  - Child components: `ProfileCompletionPrompt`, `ProfileForm`
- Handled interactions:
  - Initial fetch `GET /api/profile`
  - Retry fetch on error
  - Handle 401 by displaying signed-out UI
- Validation: None directly; delegates to `ProfileForm`.
- Types: `ProfileResponseDTO`, `ProfileDTO`, `UseProfileResult` (defined in Types section).
- Props: None (top-level view component).

### ProfileForm
- Description: Controlled form for editing allergens, disliked ingredients, and timezone with client-side validation mirroring backend (`ProfileUpdateDtoSchema`). Emits save action using `PUT /api/profile` including `If-Unmodified-Since`.
- Main elements:
  - Two `TagInput` fields (Allergens, Disliked Ingredients)
  - `TimezoneSelect` (IANA list, searchable)
  - Inline error messages per field and a form-level error summary
  - Action buttons: `Save` (primary), `Reset` (secondary)
- Handled interactions:
  - Add/remove tags
  - Select timezone
  - Submit/Save: disabled while saving or when invalid, prevents duplicate submissions
  - Reset: restores values from last loaded profile
- Validation conditions (client mirrors API):
  - allergens: array of non-empty trimmed strings; max 50 entries; duplicates disallowed
  - dislikedIngredients: same rules as allergens; independent duplicate set
  - timezone: either valid IANA identifier or null; UI encourages selection; display “UTC (default)” when null
  - Use `ProfileUpdateDtoSchema.safeParse` from `src/types.ts` before enabling Save or upon submit
- Types:
  - `ProfileUpdateDto` (request)
  - `ProfileDTO` (server data for reset/source)
  - `ProfileFormValues` (alias of `ProfileUpdateDto` for clarity)
  - `ProfileFormErrors` (derived from Zod errors)
- Props:
  - `initialValues: ProfileFormValues`
  - `lastModified: string` (RFC1123 from response header)
  - `onSave: (payload: ProfileUpdateDto, ifUnmodifiedSince: string) => Promise<ProfileDTO>`
  - `onSuccess?: (next: ProfileDTO, lastModified: string) => void`
  - `onError?: (error: SaveError) => void`

### TagInput
- Description: Reusable chip-based input to manage string lists with keyboard and mouse. Prevents duplicates and empty entries; enforces max entries.
- Main elements:
  - Label + helper text
  - List of chips (tags) with remove buttons (X) and accessible labels
  - Text input with placeholder and Enter-to-add behavior
- Handled interactions:
  - Enter/Comma adds trimmed value if non-empty and not duplicate
  - Backspace on empty input focuses last chip; Backspace/Delete removes focused chip
  - Click X removes chip
- Validation:
  - Trim whitespace; reject empty strings
  - Enforce max 50 entries; show inline counter and block adding beyond limit
  - Deduplicate case-insensitively (configurable; recommend case-insensitive)
- Types:
  - `TagList = string[]`
- Props:
  - `label: string`
  - `value: TagList`
  - `onChange: (next: TagList) => void`
  - `placeholder?: string`
  - `max?: number` (default 50)
  - `ariaDescribedBy?: string`

### TimezoneSelect
- Description: Dropdown of IANA timezones with search/filter. Uses `Intl.supportedValuesOf('timeZone')` when available; falls back to static list bundled at `src/assets/timezones.json`.
- Main elements:
  - Label
  - Combobox/select with typeahead filter
  - Helper text: “Used to reset your AI quota at local midnight. Defaults to UTC if unset.”
- Handled interactions:
  - Search and select timezone; Clear selection to set null
- Validation:
  - Selected value must be in the IANA list; otherwise show error and block Save
- Types:
  - `TimezoneOption = { id: string; label: string }`
- Props:
  - `value: string | null`
  - `onChange: (next: string | null) => void`
  - `options: TimezoneOption[]` (provided by `useTimezones`)

### ProfileCompletionPrompt
- Description: Non-blocking prompt displayed when both lists are empty to encourage profile completion. Appears above the form inside a `Card`/`Alert`.
- Main elements:
  - Title, brief explanation, and link to learn more (optional)
- Handled interactions:
  - Dismiss (remember dismissal in state for the session)
- Validation: None.
- Props:
  - `visible: boolean`
  - `onDismiss?: () => void`

## 5. Types
New or view-specific types; reuse shared DTOs from `src/types.ts`.

```ts
// Reuse from backend/shared
import type { ProfileDTO, ProfileResponseDTO, ProfileUpdateDto } from "@/types";

// View model aliases
export type ProfileFormValues = ProfileUpdateDto; // { allergens: string[]; dislikedIngredients: string[]; timezone: string | null }

export type SaveError =
  | { kind: "validation"; details: unknown }
  | { kind: "conflict" }
  | { kind: "unauthorized" }
  | { kind: "network" }
  | { kind: "server"; message?: string };

export interface UseProfileResult {
  status: "idle" | "loading" | "success" | "error" | "unauthorized";
  data: ProfileDTO | null;
  lastModified: string | null; // RFC1123 string from `Last-Modified` header
  error: unknown | null;
  refetch: () => Promise<void>;
  save: (values: ProfileUpdateDto) => Promise<ProfileDTO>;
  saving: boolean;
}

export interface AnalyticsEventProfileUpdated {
  name: "profile_updated";
  payload: {
    timezone: string | null; // user-selected tz or null
    timestampUtc: string; // ISO
  };
}
```

## 6. State Management
- Local state in React within `ProfileSettings`/`ProfileForm`.
- Custom hooks:
  - `useProfile`: encapsulates GET, tracks `data`, `lastModified` (RFC1123 from response header `last-modified`), `status`, `error`, `refetch`.
  - `useSaveProfile`: encapsulates PUT with `If-Unmodified-Since` from latest `lastModified`; exposes `saving` and a `save` function. On success, updates `data` and `lastModified` from response and headers; emits analytics event.
  - `useTimezones`: returns memoized `TimezoneOption[]` from `Intl.supportedValuesOf('timeZone')` or fallback JSON; ensures sorted by region/name.
- Form state:
  - `values: ProfileFormValues`
  - `errors: ProfileFormErrors` from Zod
  - Derived: `isDirty`, `isValid`, `canSubmit`
- Disable Save when `saving`, not dirty, or invalid.

## 7. API Integration
- GET `/api/profile`
  - Request: none
  - Response: `ProfileResponseDTO`
  - Headers: read `Last-Modified` (RFC1123) for concurrency token
  - Example response body:
```json
{
  "data": {
    "id": "uuid",
    "allergens": ["Peanuts"],
    "dislikedIngredients": ["Onions"],
    "timezone": "Europe/London",
    "createdAt": "2025-10-21T12:34:56.000Z",
    "updatedAt": "2025-10-22T08:45:00.000Z"
  }
}
```
  - Client must prefer `Last-Modified` header (e.g., `Wed, 22 Oct 2025 08:45:00 GMT`) over computing from `updatedAt`.

- PUT `/api/profile`
  - Headers:
    - `Content-Type: application/json`
    - `If-Unmodified-Since: <RFC1123 from GET response header>`
  - Body: `ProfileUpdateDto`
```json
{
  "allergens": ["Peanuts", "Shellfish"],
  "dislikedIngredients": ["Onions"],
  "timezone": "Europe/London"
}
```
  - Success 200: `ProfileResponseDTO` and `Last-Modified` header updated
  - Errors: 400 (validation or missing header), 401 (unauthorized), 409 (conflict), 500 (server)

## 8. User Interactions
- Add allergen/disliked ingredient tag:
  - Enter/Comma adds trimmed value; duplicate blocked with inline message; exceeds limit blocked
- Remove tag:
  - Click remove or Backspace/Delete via keyboard; updates value and marks form dirty
- Select timezone:
  - Pick from list or clear to set null; validates against IANA set
- Save:
  - Validates with Zod; disabled if invalid; sends PUT with `If-Unmodified-Since`
  - On success: show success toast, update form state from response, reset dirty state, emit `profile_updated` event
  - On 409: show conflict banner with “Reload latest” action to refetch
  - On 400/500/network: show error banner; keep form values for correction and retry
- Reset/Cancel:
  - Restore values to last loaded `ProfileDTO`

## 9. Conditions and Validation
- Preconditions for PUT:
  - Must include `If-Unmodified-Since` exactly as received from GET
  - Body must pass `ProfileUpdateDtoSchema`
- Component-level checks:
  - `TagInput`: trims, blocks empty/duplicate/over-limit
  - `TimezoneSelect`: restricts to known IANA options; `null` allowed
  - Form-level: use `ProfileUpdateDtoSchema.safeParse(values)`; show flattened error messages
- Disabled states:
  - Save disabled when `saving`, `!isDirty`, or validation fails
  - Inputs disabled while `saving`

## 10. Error Handling
- GET 401: render signed-out prompt with navigation to sign-in
- GET 500/network: show error banner with `Retry` button
- PUT 400: show validation messages; highlight fields
- PUT 401: show signed-out prompt
- PUT 409: show conflict banner; clicking `Reload latest` triggers refetch and overwrites form with latest server values; user can re-apply changes
- PUT 500/network: show error banner with retry; retain unsaved changes
- Missing `Last-Modified` header: fallback to `new Date(data.updatedAt).toUTCString()`; log warning

## 11. Implementation Steps
1. Routing and page shell
   - Create `src/pages/profile.astro` using `src/layouts/Layout.astro` and mount `ProfileSettings` with `client:load`.
2. Create directory `src/components/profile/` and components:
   - `ProfileSettings.tsx` (container)
   - `ProfileForm.tsx`
   - `TagInput.tsx`
   - `TimezoneSelect.tsx`
   - `ProfileCompletionPrompt.tsx`
3. Hooks
   - Implement `useTimezones` using `Intl.supportedValuesOf('timeZone')` with fallback to `src/assets/timezones.json` (add JSON asset if needed)
   - Implement `useProfile` (GET) and `useSaveProfile` (PUT) hooks handling `last-modified` header and errors
4. Validation
   - Import and use `ProfileUpdateDtoSchema` from `src/types.ts` for client-side validation
   - Add duplicate-prevention and max-count checks in `TagInput`
5. UI and accessibility
   - Use `Card`, `Button` from `src/components/ui`
   - Ensure labels, `aria-*` attributes, keyboard support for `TagInput` and `TimezoneSelect`
   - Implement a simple Toast system (shadcn/ui toaster or minimal custom) and success banner fallback
6. Wire save flow
   - `ProfileForm` calls `onSave(values, lastModified)`; container injects `If-Unmodified-Since` and handles responses
   - On success, update state and show toast; emit `profile_updated` analytics event with UTC timestamp and selected timezone
7. Empty-state prompt
   - Show `ProfileCompletionPrompt` when both arrays are empty; allow dismiss for current session
8. Error and conflict handling
   - Implement banners with Retry/Reload actions
9. Testing
   - Manual checks: add/remove tags, validation blocks, timezone selection, save success, 409 conflict (simulate by reloading page and updating quickly), 401 handling (simulate by modifying middleware if needed)
10. Documentation
   - Brief README notes in the `profile/` directory on how concurrency header is handled


