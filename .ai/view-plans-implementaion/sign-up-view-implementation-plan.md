# View Implementation Plan – Sign Up View

## 1. Overview
The Sign Up view at `/signup` enables unauthenticated users to create an account via Supabase Authentication. It uses `supabase-auth-ui` for form rendering and handles inline validation (email format, password strength), accessibility-compliant labeling, and secure redirect upon successful sign-up to the Recipe List (for MVP this is the landing or recipes index, see routing notes). The page must block authenticated users from accessing it and redirect them away.

## 2. View Routing
- Path: `/signup`
- Access: Unauthenticated only. If a session exists, redirect to the app’s main view (recipes list). For MVP, this can be `/` (landing) or `/recipes` once implemented.
- SSR: Astro page (`.astro`) that renders a React client component (`AuthForm`) for interactivity.

## 3. Component Structure
- `src/pages/signup.astro`
  - Layout: `src/layouts/Layout.astro`
  - Child (React island): `src/components/auth/AuthForm.tsx`
- Support utilities:
  - `src/db/supabase.client.ts` (existing)
  - `src/components/auth/hooks/useAuthRedirect.ts` (new)
  - `src/components/auth/hooks/useInlineValidation.ts` (new, optional wrapper around regex/zod)

Hierarchy:
- `signup.astro`
  - `Layout`
    - `AuthForm` (React)

## 4. Component Details
### signup.astro
- Description: Astro page that hosts the Sign Up flow and guards route access.
- Main elements: Layout, heading, small helper text, React island mounting `AuthForm`.
- Handled interactions: None directly (delegated to `AuthForm`).
- Validation: None directly; performs server-side session check for redirect.
- Types: None specific beyond Astro `Props`.
- Props: None.
- Behavior:
  - On server, read `Astro.locals.session` (set by middleware) to detect authenticated user. If session exists, redirect (302) to `/`.
  - Render `AuthForm` with mode="sign_up".

### AuthForm.tsx
- Description: A React component wrapping `@supabase/auth-ui-react` with theme overrides and custom inline validations for email/password prior to submission. On success, it redirects to the main app route.
- Main elements:
  - Heading and description.
  - `Auth` from `@supabase/auth-ui-react` (mode: sign_up) or a custom minimal form using Supabase JS `signUp` if finer control is needed.
  - Supplementary link to `/signin`.
  - Inline validation messages area and aria-live region.
  - Submit button state management (disabled during in-flight).
- Handled interactions:
  - `onSubmit` attempt for sign-up.
  - `onChange` for email/password inputs to run inline validation.
  - `onSuccess` to handle session state and redirect.
- Validation conditions:
  - Email must be valid RFC 5322-like pattern (reasonable regex).
  - Password min length 8; include at least 1 letter and 1 number (MVP baseline). Strength meter optional.
  - Block submit if invalid; show inline error per field; provide aria-describedby to inputs.
- Types:
  - `SignUpViewModel` (new) – local component state for form, errors, and loading.
  - `AuthResult` – minimal type for Supabase auth outcome used locally.
- Props:
  - `redirectTo?: string` – path to redirect upon success (default `/`).
  - `initialEmail?: string` – optional prefilling.

### useAuthRedirect.ts (hook)
- Description: Redirects if already authenticated and provides a `redirectAfterSignUp` helper.
- API:
  - `useAuthRedirect({ redirectIfAuthenticatedTo?: string, redirectOnSuccessTo?: string })`
  - Returns `{ redirectAfterSignUp: (path?: string) => void }`.
- Behavior:
  - On mount, check Supabase client session. If exists, navigate to `redirectIfAuthenticatedTo` (default `/`).
  - Exposes `redirectAfterSignUp` for success handler.

### useInlineValidation.ts (hook, optional)
- Description: Centralizes email/password validation.
- API:
  - `useInlineValidation()` → `{ validateEmail, validatePassword, getErrors }`
- Rules:
  - Email regex; Password >= 8 chars, at least one letter and one number.

## 5. Types
New types for the view (frontend-only):
- `SignUpViewModel`:
  - `email: string`
  - `password: string`
  - `emailError: string | null`
  - `passwordError: string | null`
  - `formError: string | null` (non-field errors)
  - `isSubmitting: boolean`
- `AuthResult`:
  - `userId?: string`
  - `error?: { message: string; code?: string }`
- Note: Core shared types remain in `src/types.ts`; sign-up does not create DTOs against internal APIs.

## 6. State Management
- Local component state within `AuthForm` using React state:
  - Stores email, password, validation errors, submission status.
- Hooks:
  - `useAuthRedirect` handles redirect logic on mount and success.
  - `useInlineValidation` (optional) for reusable validation helpers.
- No global state library required.

## 7. API Integration
- External: Supabase Auth via `supabaseClient` from `src/db/supabase.client.ts`.
- Two implementation options:
  1) `@supabase/auth-ui-react` `Auth` component configured for sign-up:
     - Props include `appearance` for Tailwind/theming and `providers={[]}` for email-only.
     - Listen to `onAuthStateChange` to detect `SIGNED_IN` and redirect.
  2) Custom form calling `supabaseClient.auth.signUp({ email, password })`:
     - Request: `{ email: string, password: string }`.
     - Response: `{ data: { user, session }, error }`.
- For MVP, use option (1) to minimize custom auth logic while still layering inline validation and disabling submit for invalid/partial inputs. If `Auth` does not expose sufficient control for inline validation, fall back to option (2).

## 8. User Interactions
- Typing email/password triggers live validation; invalid states show inline messages and set `aria-invalid`.
- Clicking “Sign Up”:
  - If invalid: prevent request, focus first invalid field.
  - If valid: call Supabase sign-up. Disable button and inputs during request.
- On success:
  - If email confirmation is disabled (typical for dev), user is signed in and redirected to `/`.
  - If email confirmation is enabled, show confirmation message and remain on page; when session updates to signed-in, redirect.
- Link “Already have an account? Sign in” navigates to `/signin`.

## 9. Conditions and Validation
- Email format must be valid; display error and `aria-describedby` for helper text.
- Password rules: length >= 8, at least one letter and one number. Show live hints and set `aria-live="polite"` region for updates.
- Disable submit when:
  - Any field invalid
  - Request in-flight
- Unauthenticated-only route guard:
  - On the server in `signup.astro`: if `locals.session?.user?.id` exists, redirect 302 to `/`.
  - On client via `useAuthRedirect` to avoid flicker.

## 10. Error Handling
- Inline field errors for email/password.
- Form-level error banner for Supabase errors (network, rate limits, password policy errors returned by Supabase).
- Accessibility:
  - `role="alert"` for form-level errors; `aria-live="assertive"`.
  - Each input ties to error text via `aria-describedby`.
- Retry: Keep inputs, allow resubmit, maintain focus management to the first error.

## 11. Implementation Steps
1) Create page route:
   - `src/pages/signup.astro`
   - Use `Layout`. On server, if `Astro.locals.session?.user?.id` exists, `return Astro.redirect('/')`.
   - Mount `AuthForm` island.
2) Install auth UI (if not installed):
   - `@supabase/auth-ui-react` and `@supabase/auth-ui-shared`.
3) Create `AuthForm.tsx` in `src/components/auth/`:
   - Accept `redirectTo?` and `initialEmail?` props.
   - Implement either `Auth` component usage or custom form with `supabaseClient.auth.signUp(...)`.
   - Add inline validation and disabled state logic.
   - Add link to `/signin`.
   - On success, call `redirectAfterSignUp(redirectTo)`.
4) Create hooks:
   - `useAuthRedirect.ts`: checks session on mount with `supabaseClient.auth.getSession()` and redirects if authenticated; exposes `redirectAfterSignUp`.
   - `useInlineValidation.ts` with `validateEmail` and `validatePassword`.
5) Styling and UI polish:
   - Use Tailwind utility classes for spacing, inputs, error text, and focus ring.
   - Ensure inputs have `id`, `label`, `aria-invalid`, `aria-describedby`.
6) Accessibility:
   - Add `aria-live` regions for validation and error messages.
   - Manage focus on first error after failed submit.
7) Testing:
   - Manual flows: invalid email, weak password, success path, network error.
   - Confirm redirect when already authenticated.
   - Confirm redirect after successful sign-up.
8) Analytics (optional for MVP if instrumentation exists):
   - Emit `profile_updated` etc. not required here; sign-up can log a simple console or placeholder for future analytics integration.
9) Security:
   - Ensure page is not accessible when authenticated (server + client guard).
   - Avoid logging sensitive data.

---

Notes/Alignments with PRD:
- Satisfies US-001 sign-up and immediate sign-in on success.
- Accessibility covered via proper labeling and aria attributes.
- No internal API usage; relies on Supabase client only.
- Redirect target aligns with MVP recipe list route once available; default fallback is `/`.
