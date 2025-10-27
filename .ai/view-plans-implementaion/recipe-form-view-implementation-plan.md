# View Implementation Plan Recipe Form View (Create/Edit)

## 1. Overview
The Recipe Form View enables users to create new recipes and edit existing ones. It provides a comprehensive, accessible form covering all recipe fields defined in the PRD and shared types: title, servings, per‑serving macros (kcal, protein, carbs, fat), recipeText, and optional lastAdaptationExplanation. The view enforces client-side validation mirroring server rules, displays inline errors, shows a live character counter for recipeText, and integrates with the backend APIs to POST new recipes and PUT updates. It supports loading and error states, prevents duplicate submissions, and emits analytics events as needed.

## 2. View Routing
- Create path: `/recipes/new`
- Edit path: `/recipes/:id/edit`
- Both routes are protected (middleware already seeds a default session for development). The pages should render client React components for interactivity inside Astro pages.

## 3. Component Structure
- `pages` (Astro shells)
  - `src/pages/recipes/new.astro` → wraps `RecipeForm` in create mode
  - `src/pages/recipes/[id]/edit.astro` → fetches recipe by `id` (SSR or CSR), renders `RecipeForm` in edit mode
- `components`
  - `RecipeForm` (React): main interactive form
    - `FieldGroup` (optional small internal component for label+input+help+error)
    - `CharacterCounter` (inline utility element within `RecipeForm`)
    - `InlineError` (inline error text)
    - Uses existing `ui/button` for actions

## 4. Component Details
### RecipeForm
- Component description: A controlled React form for creating and editing recipes. It supports initial values (edit mode), client validation mapped to Zod schemas in `src/types.ts`, accessibility attributes, and submission to the corresponding API endpoint.
- Main elements:
  - Title: labeled text input with max length 200; aria‑describedby for errors
  - Servings: labeled number input (integer >= 1, <= 50)
  - Macros: four number inputs for kcal, protein, carbs, fat (>= 0; two‑decimal precision)
  - Recipe Text: labeled textarea with 10,000 char limit and live counter
  - Optional lastAdaptationExplanation: textarea, max 2,000 chars; hidden by default in create/edit UI but supported for parity; can be included as a collapsible advanced section
  - Actions: Submit button (primary), Cancel button (secondary/ghost) linking back to list or detail
- Handled interactions:
  - Change and blur events update local state and trigger field validation
  - Submit triggers comprehensive validation, disables button, shows loading state, and calls appropriate API
  - Cancel navigates back using `window.history.back()` or links to `/`
- Handled validation (client‑side mirrors server Zod):
  - Title: required, non‑empty (trimmed), max 200
  - Servings: required integer, 1..50
  - Macros: all required and non‑negative; precision ≤ 2 decimals for each of kcal, protein, carbs, fat
  - Recipe Text: required, non‑empty (trimmed), max 10,000
  - lastAdaptationExplanation: optional null or non‑empty trimmed string ≤ 2,000
  - Over‑limit recipeText disables submit and shows error; live remaining counter displayed
- Types:
  - Uses `RecipeCreateDto`, `RecipeUpdateDto`, `RecipeDTO`, `RecipeMacroDTO` from `src/types.ts`
  - Introduces `RecipeFormValues` view model (see Types section)
  - API responses use `RecipeCreateResponseDTO` (POST) and `RecipeUpdateResponseDTO` (PUT) from `src/types.ts`
- Props:
  - `mode: "create" | "edit"`
  - `initialRecipe?: RecipeDTO` (required in edit mode)
  - `onSaved?: (recipe: RecipeDTO) => void` (optional callback)
  - `onCancel?: () => void` (optional)

### CharacterCounter (inline element)
- Purpose: renders remaining characters for `recipeText`
- Elements: small muted text with `aria-live="polite"`
- Props: `{ current: number; max: number; id?: string }`
- Behavior: turns error color when over limit

### InlineError
- Purpose: renders accessible error messages bound to inputs
- Elements: small text with `role="alert"` and unique `id`
- Props: `{ id: string; message?: string }`
- Behavior: not rendered when no message

## 5. Types
New view model types for the form layer to adapt to input controls while preserving server DTO compatibility:
- `type RecipeFormValues = {
  title: string;
  servings: string; // string to bind to number input; parsed to number on submit
  macros: {
    kcal: string;
    protein: string;
    carbs: string;
    fat: string;
  };
  recipeText: string;
  lastAdaptationExplanation?: string | null;
}`
  - Rationale: Keep inputs as strings for easier validation/formatting; coerce to numbers for API.

- `type FieldErrorMap = {
  title?: string;
  servings?: string;
  macros?: {
    kcal?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
  };
  recipeText?: string;
  lastAdaptationExplanation?: string;
  form?: string; // general form error
}`

Use existing shared types without redefining them:
- `RecipeCreateDto`, `RecipeUpdateDto`, `RecipeDTO`, `RecipeMacroDTO`, `RecipeCreateResponseDTO`, `RecipeUpdateResponseDTO`

## 6. State Management
- Local state in `RecipeForm` with `useState` for `values: RecipeFormValues`, `errors: FieldErrorMap`, `isSubmitting: boolean`, `isLoadingInitial: boolean` (edit mode), `submitError?: string`, `successMessage?: string`.
- Derived state:
  - `remainingChars = 10000 - values.recipeText.length`
  - `isOverLimit = remainingChars < 0`
  - `isSubmitDisabled = isSubmitting || isOverLimit`
- IDs for accessibility using `useId()` (e.g., error ids per field)
- Optional `useRecipeForm` custom hook can be added in `src/components/hooks/useRecipeForm.ts` if logic grows (validation, mapping, API calls). For MVP, keep logic within component for simplicity.

## 7. API Integration
- Endpoints:
  - Create: `POST /api/recipes`
    - Request: `RecipeCreateDto`
    - Response: `{ data: RecipeDTO }` (201)
  - Get (edit prefill): `GET /api/recipes/{id}`
    - Response: `{ data: RecipeDTO }` (200)
  - Update: `PUT /api/recipes/{id}?return=full`
    - Request: `RecipeUpdateDto` (partial allowed; we’ll send only changed fields or the entire payload for simplicity)
    - Response: `{ data: RecipeDTO }` (200)
- Client rules:
  - Use `fetch` with `content-type: application/json`
  - Handle 400 validation errors with server `details` mapping back to fields
  - Handle 401/404/422/500 with toast or inline `form` error
  - Prevent duplicate submissions by disabling submit while in‑flight
- Mapping values to DTOs:
  - On submit, trim strings; coerce numerics via `Number()`
  - Validate two‑decimal precision client‑side to match `MacroPrecisionErrorMessage`
  - Create payloads:
    - Create: `{ title, servings, macros: {kcal, protein, carbs, fat}, recipeText, lastAdaptationExplanation: valueOrNull }`
    - Update: send only fields changed compared to `initialRecipe`; if any macro changed, include full `macros` object

## 8. User Interactions
- Typing in inputs updates state and clears prior error for that field
- Blur triggers per‑field validation
- Submit:
  - Runs full validation; if errors, focus first invalid field and render `InlineError`s
  - If valid, POST or PUT; then on success call `onSaved(result.data)` and navigate to detail page `/recipes/{id}` or back to list
- Cancel: navigate back or call `onCancel`

## 9. Conditions and Validation
- Title: trimmed length 1..200
- Servings: integer, 1..50
- Macros: each >= 0 and precision ≤ 2 decimals; block NaN/empty
- Recipe Text: trimmed length 1..10,000; show live remaining counter; when > 10,000 disable submit and show error
- lastAdaptationExplanation: if not empty, 1..2,000; or null
- All fields use `aria-invalid` when invalid and connect to `InlineError` via `aria-describedby`

## 10. Error Handling
- Client validation errors displayed inline per field; form‑level error for non‑field server errors
- Server 400 with `details`: map to fields; unknown paths go to `form` error
- 401: redirect to sign‑in or show unauthorized message (MVP middleware provides default session; still handle gracefully)
- 404 (edit load or save): display not found and link back to list
- 422 (create insert_failed): show message near macros or form top
- 500: show generic error; allow retry
- Network failures: show inline form error and keep values

## 11. Implementation Steps
1. Create Astro route shells:
   - `src/pages/recipes/new.astro` renders `<RecipeForm mode="create" />`
   - `src/pages/recipes/[id]/edit.astro` reads `params.id`; either fetch via CSR inside `RecipeForm` when `initialRecipe` absent, or SSR fetch from `/api/recipes/{id}` and pass `initialRecipe` prop
2. Implement `RecipeForm` in `src/components/RecipeForm.tsx`:
   - Props per spec; internal state for values, errors, submitting
   - Initialize from `initialRecipe` when provided
   - Create field components with labels, `aria-*`, `InlineError`
   - Implement `CharacterCounter` for `recipeText`
   - Add validation helpers mirroring `RecipeCreateDtoSchema`/`RecipeUpdateDtoSchema` rules
   - Implement submit handler: build payload, choose POST/PUT, handle responses and errors
   - Use `Button` from `src/components/ui/button.tsx` with loading state (e.g., spinner or `aria-busy`)
3. Implement optional `InlineError` component in `src/components/InlineError.tsx` and share styles
4. Add small utility for decimal precision check consistent with server rule (`hasAtMostTwoDecimalPlaces`): `Math.round(value*100)===value*100`
5. Navigation behavior after save: redirect to recipe detail `/recipes/{id}` if exists; otherwise to `/`
6. Analytics (MVP notes):
   - On successful POST: emit `recipe_created` with UTC timestamp and timezone from `/api/profile` or `Intl.DateTimeFormat().resolvedOptions().timeZone` as fallback; queue in a simple logger service in `src/lib` for later wiring
7. Tests/manual checks:
   - Over-limit recipeText blocks submit and shows counter error
   - Macro precision enforcement works
   - PUT only updates changed fields; sending full payload also acceptable
   - Error scenarios render inline messages and form remains usable
8. Styling:
   - Use Tailwind utility classes; ensure focus-visible styles and error states
9. Accessibility:
   - Ensure labels, `aria-describedby`, `aria-invalid`, `aria-live` for dynamic error/counter
