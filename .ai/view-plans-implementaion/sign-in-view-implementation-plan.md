# View Implementation Plan — Sign In

## 1. Overview
A dedicated Sign In view that enables existing users to authenticate using email and password via Supabase Auth. The view is accessible to unauthenticated users only. On successful sign in, users are redirected to the Recipe List view (`/recipes`). Invalid credentials display clear, accessible error messages.

## 2. View Routing
- Path: `/login`
- Access: unauthenticated only. If a session exists, redirect to `/recipes`.
- Redirect target on success: `/recipes` (Recipe List view). If the list view changes path later, update the redirect constant in the component.

## 3. Component Structure
- `src/pages/login.astro`
  - Uses layout `src/layouts/Layout.astro`
  - Renders React component `AuthForm` (client-side)
- `src/components/auth/AuthForm.tsx`
  - Wrapper around `@supabase/auth-ui-react` configured for sign-in via email/password
  - Uses Shadcn `Card` UI for container styling
  - Handles state, validation, error display, and redirects
- (Optional) `src/lib/auth.ts`
  - Small helpers for redirect target, session checks, and error normalization

Component tree:
```
/login (Astro)
└─ AuthForm (React)
   ├─ Card (Shadcn)
   └─ Auth (supabase-auth-ui-react)
```

## 4. Component Details
### LoginPage (`src/pages/login.astro`)
- Component description: Astro page that hosts the Sign In form.
- Main elements:
  - Layout wrapper
  - Centered container with `AuthForm`
- Handled interactions: Delegated to `AuthForm`.
- Handled validation: None (delegated to `AuthForm`).
- Types: None.
- Props: None.

### AuthForm (`src/components/auth/AuthForm.tsx`)
- Component description: Interactive React component providing the sign-in UI and logic using `@supabase/auth-ui-react`. It orchestrates validation, error handling, and redirects on successful authentication.
- Main elements:
  - `Card` container (`src/components/ui/card.tsx`)
  - `Auth` from `@supabase/auth-ui-react` with `view="sign_in"`
  - Inline error message area with `role="alert"` and `aria-live="polite"`
  - Link to Sign Up view (`/signup`)
- Handled interactions:
  - Submit sign-in with email and password
  - Toggle password visibility (native input or UI library support)
  - Link click to `/signup`
- Handled validation (component-level):
  - Email: required, basic format (native `type="email"` and/or regex)
  - Password: required (non-empty)
  - Submit disabled while request in-flight (prevents duplicate submissions)
  - On Supabase `AuthApiError` with status 400/401 → show "Invalid email or password"; other errors → show generic friendly error
- Types:
  - `SignInFormValues` — `{ email: string; password: string; }`
  - `AuthStatus` — `'idle' | 'submitting' | 'error'`
  - `AuthErrorState` — `{ message: string; code?: string } | null`
  - `AuthRedirectTarget` — string path (default `'/recipes'`)
  - `SupabaseClient` type imported from `src/db/supabase.client.ts`
- Props:
  - `redirectTo?: string` — default `'/recipes'`
  - `title?: string` — optional heading (defaults to "Sign in")
  - `className?: string` — optional extra class names

## 5. Types
- `SignInFormValues`
  - `email: string` — user email
  - `password: string` — user password
- `AuthStatus` — union `'idle' | 'submitting' | 'error'`
- `AuthErrorState`
  - `message: string` — human-readable error for display
  - `code?: string` — optional error code for telemetry
- `AuthRedirectTarget` — string path (default `'/recipes'`)
- Supabase types
  - Import `SupabaseClient` from `src/db/supabase.client.ts` for type safety

Note: No shared app DTOs from `src/types.ts` are required for this view because authentication uses the Supabase client directly (no internal REST endpoints).

## 6. State Management
- Local component state in `AuthForm`:
  - `status: AuthStatus` — controls loading/disabled state
  - `error: AuthErrorState` — holds current error message
- Effects:
  - On mount: fetch session via `supabase.auth.getSession()`; if present → redirect immediately
  - Subscribe to `supabase.auth.onAuthStateChange` to catch successful sign-in and redirect
- Optional custom hooks (for clarity):
  - `useRedirectOnAuth(supabase, redirectTo)` — encapsulates `getSession` + `onAuthStateChange`
  - `useAuthErrors()` — normalizes Supabase errors to user-friendly messages

## 7. API Integration
- External API: Supabase Auth (`@supabase/supabase-js`)
- Browser client:
  - Use `import.meta.env.PUBLIC_SUPABASE_URL` and `import.meta.env.PUBLIC_SUPABASE_ANON_KEY`
  - Create in `src/lib/auth.ts`:
    ```ts
    import { createClient } from "@supabase/supabase-js";
    import type { SupabaseClient as SupabaseJsClient } from "@supabase/supabase-js";
    import type { Database } from "../db/database.types";

    export type SupabaseClient = SupabaseJsClient<Database>;

    export function createBrowserSupabaseClient(): SupabaseClient {
      const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
      const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;
      return createClient<Database>(url, anon);
    }
    ```
- Methods used:
  - `supabase.auth.signInWithPassword({ email, password })`
    - Request type:
      ```ts
      type SignInRequest = { email: string; password: string };
      ```
    - Response shape:
      ```ts
      type SignInResponse = {
        data: { user: unknown | null; session: unknown | null };
        error: { message: string; status?: number } | null;
      };
      ```
  - `supabase.auth.getSession()` — check if session exists
  - `supabase.auth.onAuthStateChange((event, session) => { ... })` — redirect on `'SIGNED_IN'`

## 8. User Interactions
- Fill email and password → click "Sign In"
  - Validate locally; disable button; call Supabase
  - On success → redirect to `redirectTo` (default `/recipes`)
  - On invalid credentials → show accessible error; remain on `/login`
- Click "Sign Up" link → navigate to `/signup`

## 9. Conditions and Validation
- Email: required; basic email format (or rely on native `type="email"`)
- Password: required; non-empty
- Submit button disabled when:
  - Validation fails, or
  - `status === 'submitting'`
- Authenticated users should not see the form:
  - On mount, if `getSession()` returns a session → immediate redirect

## 10. Error Handling
- Invalid credentials (HTTP 400/401): show "Invalid email or password. Please try again."
- Network/timeouts: show "We couldn’t sign you in. Check your connection and try again."
- Unexpected errors: generic error with optional code
- Accessibility:
  - Errors announced via `aria-live="polite"`
  - Inputs set `aria-invalid` when errors present

## 11. Implementation Steps
1. Dependencies
   - Install `@supabase/auth-ui-react` (and `@supabase/auth-ui-shared` if required by version)
   - Ensure `@supabase/supabase-js` is present (already listed)
2. Environment
   - Add to `.env`:
     - `PUBLIC_SUPABASE_URL=...`
     - `PUBLIC_SUPABASE_ANON_KEY=...`
   - Never expose service role keys on the client
3. Supabase browser client
   - Implement `createBrowserSupabaseClient()` in `src/lib/auth.ts` (as above)
4. UI component
   - Create `src/components/auth/AuthForm.tsx`:
     - Render `Card` with title/description
     - Render `Auth` with `view="sign_in"`, pass supabase client instance
     - Manage `status` and `error` state; display error region
     - Footer with link to `/signup`
     - Subscribe to `onAuthStateChange` and redirect
5. Page
   - Create `src/pages/login.astro`:
     - Use `Layout`
     - Centered container; mount `<AuthForm client:only="react" />`
     - Optionally read `redirectTo` from query and pass to `AuthForm`
6. Redirect logic
   - On mount, call `getSession()`; redirect if already authenticated
   - Redirect on `'SIGNED_IN'` event
7. Validation & UX
   - Ensure email/password required (native checks suffice)
   - Disable submit while signing in
   - Show clear, accessible error messages
8. Accessibility
   - Ensure labels for inputs (library provides)
   - Keep visible focus outlines; logical tab order
9. Security
   - Use only PUBLIC env vars in the browser
   - Note: current dev middleware sets a default session; in production, ensure real session gating and remove any default sessions
10. Testing
   - Valid credentials → redirects to `/recipes`
   - Invalid credentials → error remains on `/login`
   - Existing session → immediate redirect away from `/login`
   - Offline/network error → user sees retry guidance
   - Keyboard-only and screen reader flows verified
