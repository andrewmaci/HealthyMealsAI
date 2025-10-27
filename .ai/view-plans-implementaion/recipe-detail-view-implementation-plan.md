## View Implementation Plan: Recipe Detail

### 1. Overview
The Recipe Detail view at `/recipes/:id` displays a single recipe’s full details and enables users to manage and adapt it with AI. It must show title, servings, all macros, the full `recipeText`, optional `lastAdaptationExplanation`, and the user’s remaining daily adaptation quota. From here, users can delete the recipe (with confirmation) and initiate the multi-step Adaptation Wizard to propose and optionally accept an AI-generated adaptation that overwrites the recipe.

### 2. View Routing
- Path: `/recipes/:id`
- Astro page file: `src/pages/recipes/[id].astro`
- Render strategy: Astro page renders a React container component (`RecipeDetailPage`) with `client:load` for interactivity.
- Protected route: Middleware (`src/middleware/index.ts`) injects `context.locals.supabase` and a session. Frontend should gracefully handle 401 in fetch responses (redirect or error state).
- 404 behavior: If GET `/api/recipes/{id}` returns 404, show a Not Found state with navigation back to the list.

### 3. Component Structure
- `src/pages/recipes/[id].astro`
  - `RecipeDetailPage` (React, client:load)
    - `HeaderBar`
      - Title, actions: Edit (if available), Delete
      - `AlertDialog` (confirm deletion)
    - `NotificationBox` (shows `lastAdaptationExplanation` if present)
    - `RecipeDisplay`
      - Macros summary (Card grid)
      - Servings
      - Formatted `recipeText`
    - `AdaptationToolbar`
      - `AdaptationButton` (shows remaining quota, tooltip when disabled)
      - Optional `QuotaChip`
    - `AdaptationWizard` (Modal)
      - StepSelectGoal (single goal + notes with counter)
      - StepLoading/Pending (submission in-flight, or 202 pending)
      - StepProposalReview (proposed recipe and macros; Original collapsible)
      - MacroEditor (allow manual macro overrides with validation)
      - SafetyDisclaimer (persistent notice)
    - `ToastArea` (or equivalent) for transient notifications

### 4. Component Details
#### RecipeDetailPage
- Purpose: Container responsible for data fetching, state, and orchestration.
- Main elements: header, info notice, recipe display, adaptation toolbar, modal, toasts.
- Handled interactions:
  - Load recipe and quota in parallel on mount.
  - Open/close AdaptationWizard.
  - Delete flow (open confirm, submit DELETE, redirect on success).
  - Emit analytics events: `ai_requested`, `ai_succeeded`, `ai_accepted` with UTC timestamp and timezone if available.
- Validation handled:
  - None directly; delegates to child components and API responses.
- Types used:
  - `RecipeDTO`, `RecipeResponseDTO`, `AdaptationQuotaResponseDTO` from `src/types.ts`.
  - ViewModels: `RecipeDetailVM`, `AdaptationFlowState` (see Types section).
- Props: none (top-level page component).

#### HeaderBar
- Purpose: Shows page title and recipe actions.
- Elements: heading (`h1`), action buttons (Edit optional, Delete primary), `AlertDialog`.
- Interactions:
  - Delete button opens `AlertDialog`.
  - Confirm triggers API DELETE; on 204 success navigate back to `/` (or recipes list); on 404 show error toast and remain; on 500 show generic error.
- Validation: N/A.
- Types: none.
- Props:
  - `title: string`
  - `onDelete: () => Promise<void>` (wraps DELETE call)

#### NotificationBox
- Purpose: Display `lastAdaptationExplanation` when present. Non-dismissable informational area above the recipe.
- Elements: bordered info box with icon, short heading, content text.
- Interactions: none.
- Validation: show only if `lastAdaptationExplanation` is non-null/non-empty.
- Types: none.
- Props:
  - `explanation: string | null`

#### RecipeDisplay
- Purpose: Present recipe core data clearly and accessibly.
- Elements:
  - Title (provided in header)
  - Servings badge or text
  - Macros card grid (kcal, protein, carbs, fat)
  - `recipeText` rendered with `whitespace-pre-wrap` and sensible typography; maintain newlines.
- Interactions: none.
- Validation:
  - Ensure macros display as non-negative numbers with up to 2 decimals.
  - Large text: handle up to 10,000 chars; clipping not required, but ensure performance and wrap.
- Types: `RecipeDTO`.
- Props:
  - `recipe: RecipeDTO`

#### AdaptationToolbar
- Purpose: Area hosting the Adaptation entry points and quota.
- Elements: `AdaptationButton`, optional quota text/chip.
- Interactions:
  - Clicking `AdaptationButton` opens the wizard when enabled.
- Validation:
  - Disable button when `quota.remaining === 0`.
  - Tooltip explains reason and reset timing.
- Types: `AdaptationQuotaDTO`.
- Props:
  - `quota: AdaptationQuotaDTO | null`
  - `onOpenWizard: () => void`

#### AdaptationButton
- Purpose: Primary call-to-action for adaptation; reflects remaining quota.
- Elements: Shadcn `Button`; optional `Tooltip` when disabled.
- Interactions:
- Click -> open wizard if enabled and not in-flight.
- Validation:
  - Disabled when `remaining === 0`.
  - While request in-flight, keep disabled to prevent duplicates.
- Types: `AdaptationQuotaDTO`.
- Props:
  - `remaining: number | null`
  - `limit: number | null`
  - `disabled: boolean`
  - `onClick: () => void`

#### AdaptationWizard (Modal)
- Purpose: Multi-step flow to gather a goal/notes, submit to AI, review proposal, optionally edit macros, and accept or decline.
- Elements:
  - StepSelectGoal: radio group for `AdaptationGoal` (exactly one), notes `Textarea` with live counter.
  - StepLoading/Pending: spinner, status text; if 202 pending, show persistent pending state with retry/back/cancel controls.
  - StepProposalReview:
    - Proposed recipe_text (formatted), proposed macros table, explanation.
    - Collapsible "Original recipe" panel showing original `recipeText`.
  - MacroEditor: four numeric inputs (kcal, protein, carbs, fat) with `step=0.01` and min=0, enforcing max two decimals.
  - SafetyDisclaimer: persistent notice per PRD.
  - Footer actions: Cancel/Close; Back (where applicable); Submit; Accept.
- Interactions:
  - Submit (POST `/api/recipes/{id}/adaptations`) with Zod-validated body; pass `Idempotency-Key` header (`crypto.randomUUID()`), disable during in-flight.
  - On 200 with proposal -> show StepProposalReview, emit `ai_succeeded`.
  - On 202 -> show Pending; optionally re-submit or provide a Retry action.
  - Accept (POST `/api/recipes/{id}/adaptations/accept`) with possibly edited macros and explanation; confirm overwrite; on success, close modal and refresh recipe; emit `ai_accepted`.
  - Decline/Close: close modal without changes.
- Validation:
  - Goal: required; one of `remove_allergens | remove_disliked_ingredients | reduce_calories | increase_protein`.
  - Notes: optional, trimmed, max 500; live counter, block submit if >500.
  - Macros: non-negative, at most two decimals (mirror `MacroPrecisionErrorMessage`).
  - Recipe text length: enforce <= 10,000 when accepting.
- Types:
  - Request: `RecipeAdaptationRequestDto` (shape mirrors `RecipeAdaptationRequestDtoSchema`).
  - Response: `RecipeAdaptationProposalResponseDTO` or `AdaptationPendingResponseDTO`.
  - Accept request: `RecipeAdaptationAcceptDto`.
- Props:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `recipe: RecipeDTO`
  - `onAccepted: (updated: RecipeDTO) => void`
  - `onRequested: () => void` (analytics)
  - `timezone: string | 'UTC'`

#### AlertDialog (Delete confirmation)
- Purpose: Confirm destructive action.
- Elements: Dialog with title, description, Cancel and Delete buttons.
- Interactions:
  - Confirm invokes `onConfirm` -> triggers DELETE and handles navigation.
- Validation: N/A.
- Props:
  - `open: boolean`
  - `onOpenChange: (open: boolean) => void`
  - `onConfirm: () => Promise<void>`

### 5. Types
New ViewModel and helper types to complement `src/types.ts`:

- `RecipeDetailVM`
  - `recipe: RecipeDTO`
  - `quota: AdaptationQuotaDTO | null`
  - `loading: boolean` (initial data load)
  - `error: string | null`

- `AdaptationFlowState`
  - `step: 'closed' | 'select' | 'submitting' | 'pending' | 'proposal' | 'accepting' | 'error'`
  - `selectedGoal: AdaptationGoal | null`
  - `notes: string`
  - `notesCount: number` (derived) and `notesLimit: number` (500 default)
  - `proposal: null | { logId: string; proposedRecipe: { recipeText: string; macros: RecipeMacroDTO }; explanation: string }`
  - `editedMacros: RecipeMacroDTO | null` (if user overrides)
  - `validationErrors: { notes?: string; macros?: Partial<Record<keyof RecipeMacroDTO, string>> }`
  - `requestError: string | null`
  - `idempotencyKey: string | null`

- `MacroInputField` (for form)
  - `{ name: keyof RecipeMacroDTO; value: string; error?: string }`

Use existing DTOs from `src/types.ts` for API payloads and responses:
- `RecipeResponseDTO`, `RecipeDTO`, `RecipeListResponseDTO`
- `AdaptationQuotaDTO`, `AdaptationQuotaResponseDTO`
- `RecipeAdaptationRequestDto`, `RecipeAdaptationProposalResponseDTO`, `AdaptationPendingResponseDTO`
- `RecipeAdaptationAcceptDto`

### 6. State Management
- Local component state via React hooks; no global state library needed.
- Custom hooks:
  - `useRecipeDetail(id: string)`
    - Manages loading of recipe and delete action.
    - Returns `{ recipe, loading, error, refresh, deleteRecipe }`.
  - `useQuota()`
    - Fetches quota; exposes `{ quota, loading, error, refresh }`.
  - `useAdaptationFlow(recipe: RecipeDTO)`
    - Manages wizard state machine, validation, submission, pending, proposal, accept.
    - Exposes actions: `open`, `close`, `selectGoal`, `updateNotes`, `submit`, `accept`, `overrideMacros`, `reset`.
    - Emits analytics hooks: `onRequested`, `onSucceeded`, `onAccepted` callbacks.
- Derived state:
  - `canSubmitRequest` depends on goal selected, notes length <= 500, not in-flight, quota remaining > 0.
  - `canAccept` depends on edited macros valid and recipe text length <= 10,000.

### 7. API Integration
Endpoints and expected types (all responses wrapped in `StandardResponse<T>` unless noted):

- GET `/api/recipes/{id}` → 200 `RecipeResponseDTO`; 401, 404, 500 errors.
- DELETE `/api/recipes/{id}` → 204 No Content; 401, 404, 409, 500.
- GET `/api/adaptations/quota` → 200 `AdaptationQuotaResponseDTO`; 401, 500.
- POST `/api/recipes/{id}/adaptations`
  - Request body: `RecipeAdaptationRequestDto` (`{ goal, notes? }`), header `Idempotency-Key` ≤ 64 chars.
  - Success: 200 `RecipeAdaptationProposalResponseDTO` or 202 `AdaptationPendingResponseDTO`.
  - Errors: 400, 401, 403 (quota), 409 (in progress), 422 (invalid AI), 429, 500.
- POST `/api/recipes/{id}/adaptations/accept`
  - Request body: `RecipeAdaptationAcceptDto` (`{ logId, recipeText, macros, explanation }`).
  - Success: 200 `RecipeResponseDTO` (updated recipe).
  - Errors: 400, 401, 404, 409, 422, 500.
- Optional GET `/api/recipes/{id}/adaptations` → 200 `RecipeAdaptationHistoryResponseDTO`.

Client helpers (to implement inside the page or a small `api.ts` util):
- `fetchRecipe(id): Promise<RecipeDTO>`
- `fetchQuota(): Promise<AdaptationQuotaDTO>`
- `proposeAdaptation(id, dto, idempotencyKey): Promise<'pending' | RecipeAdaptationProposalDTO>`
- `acceptAdaptation(id, dto): Promise<RecipeDTO>`
- `deleteRecipe(id): Promise<void>`

Notes:
- Always disable buttons during in-flight requests to satisfy US-061.
- Use `crypto.randomUUID()` for `Idempotency-Key` per attempt; cache per open wizard session to avoid duplicates.
- Emit analytics with UTC timestamps and include `quota.timezone` where applicable.

### 8. User Interactions
- Load page: fetch recipe and quota in parallel; show skeletons/spinners.
- Click Adapt with AI:
  - If `remaining === 0`, show tooltip message and keep disabled.
  - Else open wizard at StepSelectGoal.
- Enter notes: live counter; when >500, show error and disable submit.
- Submit request: disable submit, send POST; emit `ai_requested`; on 200, advance to proposal and emit `ai_succeeded`; on 202, show pending screen.
- View proposal: review proposed text, macros, explanation; original panel collapsible.
- Edit macros: immediate validation; invalid input shows inline errors and disables Accept.
- Accept: show confirmation dialog; on confirm POST accept; on success close wizard, refresh recipe on page with new content; emit `ai_accepted`.
- Decline/Cancel: close wizard, no changes, no quota decrement.
- Delete: open `AlertDialog`; on confirm DELETE and navigate back; on error show toast.

### 9. Conditions and Validation
- Quota enforcement in UI:
  - Disable AdaptationButton when `quota.remaining === 0` and show tooltip: "Daily limit reached. Resets at local midnight." Include `quota.windowEnd` and `quota.timezone` displayed in user-friendly format.
- AdaptationWizard validations:
  - Goal: required; exactly one selected.
  - Notes length: ≤ 500; live counter in StepSelectGoal.
  - Macro validation: non-negative numbers, ≤ 2 decimals (mirror `MacroPrecisionErrorMessage`). Inputs use `step=0.01`, `min=0`, custom formatter; reject invalid on blur; disable Accept if any errors.
  - Recipe text length: show char count in proposal view; block Accept if >10,000.
- Prevent duplicates:
  - Disable submit while in-flight (US-061).
  - Provide and reuse `Idempotency-Key` during a single submission attempt.
- Accessibility:
  - Modal traps focus; `aria-modal`, `role="dialog"`, labelled by heading.
  - Buttons have `aria-disabled` and tooltips use `aria-describedby`.
  - Collapsible Original panel uses proper `aria-expanded` and `aria-controls`.

### 10. Error Handling
- GET recipe: 404 → Not Found view; 500 → generic error with retry button.
- GET quota: Failure → show banner warning and keep AdaptationButton enabled unless server enforces; optimistic but safe messaging.
- POST adaptations:
  - 403 quota exceeded → close wizard or show error state and keep button disabled.
  - 409 in progress → show info toast: request already in progress; keep submit disabled.
  - 422 invalid AI → show error state with retry guidance; do not decrement quota.
  - 429 rate limit → show backoff message; allow retry later.
  - Network/500 → error state with retry.
- 202 pending: show pending screen; optional manual Retry button to recheck by resubmitting (idempotency key not required for retry if backend cache exists; but new key is fine since server guards duplicates).
- POST accept: 404/409 → show conflict/ownership error; keep wizard open; allow retry or close.
- DELETE: 404 → already removed or not found; navigate back with warning toast; 409/500 → show error toast.

### 11. Implementation Steps
1. Create routing file `src/pages/recipes/[id].astro` that mounts `RecipeDetailPage` with `client:load` and passes the route param `id` via props.
2. Implement `RecipeDetailPage.tsx` under `src/components/`:
   - Internal fetchers for recipe and quota; run in `useEffect` on mount (parallel with `Promise.all`).
   - Render header, notification, recipe display, adaptation toolbar, and wizard.
   - Implement delete handler calling DELETE; on success `window.location.href = '/'` (or recipes list page).
   - Wire analytics emission helper (console-based stub for MVP) with UTC timestamps and `quota.timezone`.
3. Build `HeaderBar.tsx` with `AlertDialog` confirmation using shadcn/ui primitives; fall back to a simple custom dialog if primitives are not present.
4. Build `NotificationBox.tsx` (info card) for `lastAdaptationExplanation`.
5. Build `RecipeDisplay.tsx`:
   - Macros grid using `Card` from `src/components/ui/card.tsx`.
   - Servings; `recipeText` in a `div` with `whitespace-pre-wrap`, readable line-height.
6. Build `AdaptationToolbar.tsx` and `AdaptationButton.tsx` with tooltip; include remaining/limit text.
7. Build `AdaptationWizard/` subtree:
   - `Modal` wrapper (Dialog) that traps focus.
   - `StepSelectGoal.tsx`: radio group, notes textarea with counter and max length enforcement.
   - `StepLoading.tsx` and `StepPending.tsx` screens.
   - `StepProposalReview.tsx`: show proposed `recipeText`, proposed macros, explanation; collapsible Original.
   - `MacroEditor.tsx`: four inputs with validation and error messages.
   - `SafetyDisclaimer.tsx`: persistent notice text from PRD.
   - Footer buttons: Cancel, Back, Submit, Accept with proper disabled states.
8. Implement `useQuota`, `useRecipeDetail`, `useAdaptationFlow` hooks in `src/components/hooks/`.
9. Implement a small `analytics.ts` helper under `src/lib/` that queues logs (console for MVP) for `ai_requested`, `ai_succeeded`, `ai_accepted` with `{ event, timestampUtc, timezone }`.
10. Integrate API calls per section 7; ensure all fetch paths match provided endpoints and wrap/unwrap `StandardResponse`.
11. Add accessibility attributes: aria labels, aria-live for toast area, proper focus handling on open/close of dialogs.
12. Add loading and error states: skeletons for recipe display, inline errors for forms, toasts for unexpected errors.
13. QA against User Stories (US-022, US-024, US-033–US-039, US-060–US-062, US-050): verify acceptance criteria end-to-end.
14. Optional: Implement GET adaptation history viewer later; keep Wizard extensible to include a History tab.


