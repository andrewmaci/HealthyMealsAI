## View Implementation Plan: Recipe List View (Dashboard)

## 1. Overview
The Recipe List View presents a paginated, filterable, and sortable list of the authenticated user’s recipes. It serves as the primary dashboard, supports searching by title/content, macro range filtering (kcal, protein), sorting, and displays an empty state with a CTA to create a new recipe when none exist. The view integrates with GET /api/recipes and reflects query state in the URL for shareability and back/forward navigation.

## 2. View Routing
- Path: `/recipes`
- Auth: Protected route (enforced by `src/middleware/index.ts` via session). If the app later decides to route authenticated users from `/` to `/recipes`, a middleware or server-side redirect can be added.

## 3. Component Structure
- Astro Page: `src/pages/recipes.astro`
  - React Island: `RecipeListView` (client:load)
    - Toolbar
      - `SearchBar`
      - `FilterButton` → opens `FilterModal`
      - `SortControls`
    - `ResultsSummary`
    - Content Area
      - `RecipeGrid`
        - `RecipeCard`[] | `RecipeCardSkeleton`[]
      - `EmptyState` (when no items)
    - `Pagination`
    - `ErrorBanner` (non-blocking, appears above content)
    - Portals/Modals
      - `FilterModal`

## 4. Component Details
### RecipesPage (Astro)
- Component description: Server-rendered shell that mounts the React island.
- Main elements: Container layout, page heading, React island for dynamic behavior.
- Handled interactions: None (delegated to island).
- Handled validation: None (delegated to island).
- Types: None directly.
- Props: None.

### RecipeListView (React)
- Component description: Orchestrates query state, data fetching, and rendering of toolbar, list, pagination, modal, and error states.
- Main elements: Wrapper; toolbar; summary; grid; pagination; modal; alert.
- Handled interactions:
  - Search input changes (debounced).
  - Open/close filter modal; apply/reset filters.
  - Change sort by and sort order.
  - Pagination: next/prev and specific page selection.
  - Retry on error.
- Handled validation:
  - Client-side validation mirrors API: `page>=1`, `pageSize∈[1,50]`, `sortBy∈{"created_at","updated_at","title"}`, `sortOrder∈{"asc","desc"}`, macro ranges non-negative with `min<=max`.
- Types:
  - Uses `RecipeListResponseDTO`, `RecipeDTO`, `PaginationDTO`, `GetRecipesQuery`.
  - ViewModels: `RecipeListQueryState`, `RecipeListItemVM`, `FilterFormValues`, `ApiError`.
- Props: None (self-contained; uses URL query params).

### SearchBar
- Component description: Text input for searching by title or recipe text; debounced updates to URL state.
- Main elements: `input[type="search"]`, clear button.
- Handled interactions: onChange (debounced 300–400ms), onClear (immediate), Enter key submits immediately.
- Handled validation: Max length is optional; trim whitespace; empty string removes `search` from URL.
- Types: `search?: string` prop; `onSearchChange(nextSearch?: string)` callback prop.
- Props:
  - `value?: string`
  - `onChange(value?: string): void`
  - `isLoading?: boolean`

### FilterButton
- Component description: Button showing filter modal; indicates active filters count.
- Main elements: Button with badge (active count), tooltip.
- Handled interactions: onClick opens modal; onReset clears filters via parent callback.
- Handled validation: None (display only).
- Types: `FilterFormValues` read-only to compute active count.
- Props:
  - `activeFilters: FilterFormValues`
  - `onOpen(): void`
  - `onReset(): void`

### FilterModal
- Component description: Modal dialog to set macro ranges (kcal, protein). Optional extension for carbs/fat if desired later.
- Main elements: Dialog with labeled number inputs for `minKcal`, `maxKcal`, `minProtein`, `maxProtein`; actions Apply, Reset, Cancel; helper text for validation errors.
- Handled interactions: Apply (validates and submits), Reset (clears), Cancel (closes without changes), Escape/overlay close.
- Handled validation:
  - Numbers must be `>=0` when present.
  - `min<=max` constraints enforced per macro dimension.
  - Empty inputs treated as undefined; do not submit NaN.
- Types: `FilterFormValues`.
- Props:
  - `open: boolean`
  - `initialValues: FilterFormValues`
  - `onClose(): void`
  - `onApply(values: FilterFormValues): void`
  - `onReset(): void`

### SortControls
- Component description: Select controls for sort by and sort order.
- Main elements: Two selects or a composite control; labels for accessibility.
- Handled interactions: onChange for `sortBy`, `sortOrder`.
- Handled validation: Constrain options to allowed enums.
- Types: `RecipeSortBy`, `SortOrder`.
- Props:
  - `sortBy: RecipeSortBy`
  - `sortOrder: SortOrder`
  - `onChange(next: { sortBy: RecipeSortBy; sortOrder: SortOrder }): void`

### ResultsSummary
- Component description: Displays result count and range (e.g., “Showing 11–20 of 87”).
- Main elements: Text with bolded numbers.
- Handled interactions: None.
- Handled validation: Clamp computed range within [1,totalItems].
- Types: `PaginationDTO` and current `data.length`.
- Props:
  - `pagination: PaginationDTO`
  - `itemsOnPage: number`

### RecipeGrid
- Component description: Responsive grid containing `RecipeCard` or skeletons.
- Main elements: CSS grid with Tailwind classes.
- Handled interactions: None (delegated to child cards).
- Handled validation: None.
- Types: `RecipeListItemVM[]`.
- Props:
  - `items: RecipeListItemVM[]`
  - `isLoading: boolean`
  - `skeletonCount: number`

### RecipeCard
- Component description: Recipe summary card with title, key macros, servings, and updated timestamp; clickable area navigates to detail.
- Main elements: Card (shadcn/ui), title, macro badges, meta.
- Handled interactions: onClick navigates to `/recipes/{id}`; keyboard accessible via `button` semantics/anchor.
- Handled validation: None.
- Types: `RecipeListItemVM`.
- Props:
  - `item: RecipeListItemVM`

### RecipeCardSkeleton
- Component description: Placeholder skeletons matching card layout while loading.
- Main elements: Animated blocks.
- Handled interactions: None.
- Handled validation: None.
- Types: None.
- Props:
  - `count: number`

### Pagination
- Component description: Navigation between pages with previous/next and page numbers; ARIA-labelled.
- Main elements: `nav[aria-label="Pagination"]`, list of page buttons, prev/next.
- Handled interactions: onPageChange; keyboard navigation; `aria-current` on active page.
- Handled validation: Disable prev on first page; disable next when on last; clamp target page to `[1,totalPages]`.
- Types: `PaginationDTO`.
- Props:
  - `pagination: PaginationDTO`
  - `onPageChange(page: number): void`

### EmptyState
- Component description: Shown when no recipes match criteria; prompts to create recipe.
- Main elements: Message, secondary guidance, primary CTA button.
- Handled interactions: CTA navigates to `/recipes/new`.
- Handled validation: None.
- Types: None.
- Props:
  - `ctaHref?: string` (default `/recipes/new`)

### ErrorBanner
- Component description: Non-blocking alert for fetch errors.
- Main elements: Alert (shadcn/ui), message, Retry button.
- Handled interactions: Retry triggers refetch; dismiss hides alert.
- Handled validation: None.
- Types: `ApiError`.
- Props:
  - `error?: ApiError`
  - `onRetry(): void`

## 5. Types
New or view-specific types (TypeScript):
```ts
// Query state mirrored from backend schema, optional fields omitted when undefined
export type RecipeSortBy = "created_at" | "updated_at" | "title";
export type SortOrder = "asc" | "desc";

export type RecipeListQueryState = {
  page: number;           // >=1
  pageSize: number;       // 1..50
  search?: string;        // trimmed; empty => undefined
  sortBy: RecipeSortBy;   // default: "updated_at"
  sortOrder: SortOrder;   // default: "desc"
  minKcal?: number;       // >=0
  maxKcal?: number;       // >=0 and >= minKcal when both present
  minProtein?: number;    // >=0
  maxProtein?: number;    // >=0 and >= minProtein when both present
};

export type FilterFormValues = Pick<RecipeListQueryState,
  "minKcal" | "maxKcal" | "minProtein" | "maxProtein"
>;

export type RecipeListItemVM = {
  id: string;
  title: string;
  servings: number;
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  updatedAtIso: string;        // ISO string
  updatedAtRelative: string;   // e.g., "2d ago" (computed client-side)
};

export type ApiError = {
  status: 400 | 401 | 500;
  message: string;
};
```
- Backend DTOs reused: `RecipeDTO`, `RecipeListResponseDTO`, `PaginationDTO`, `GetRecipesQuery` from `src/types.ts`.

## 6. State Management
- Local component state within `RecipeListView`:
  - `query: RecipeListQueryState` (source of truth synchronized with URL query params).
  - `data?: RecipeListResponseDTO`.
  - `isLoading: boolean`.
  - `error?: ApiError`.
  - `isFilterOpen: boolean`.
- URL synchronization:
  - Parse on mount to seed `query` (read `window.location.search`).
  - On changes (search, filters, sort, page, pageSize), update `history.replaceState` (debounced for search) to avoid extra entries; use `pushState` for page changes when appropriate.
  - Listen to `popstate` to re-apply state when navigating back/forward.
- Custom hooks:
  - `useDebouncedValue<T>(value, delay)` for search.
  - `useQueryStateSync()` encapsulating URL <-> state conversion, applying defaults and client-side validation/clamping.
  - `useRecipes(query)` to perform fetch with `AbortController`, manage loading/error, and surface `refetch()`.

## 7. API Integration
- Endpoint: `GET /api/recipes`
- Request query type: `GetRecipesQuery` (mirror on client via `RecipeListQueryState`).
- Response type: `RecipeListResponseDTO`.
- Request construction:
  - Build URL with only defined fields from `query`.
  - Example params: `page`, `pageSize`, `search`, `sortBy`, `sortOrder`, `minKcal`, `maxKcal`, `minProtein`, `maxProtein`.
- Fetch behavior:
  - Use `fetch('/api/recipes?'+params)` with `credentials: 'same-origin'`.
  - Handle statuses:
    - 200: parse JSON; map to VMs.
    - 400: show validation error in `ErrorBanner` with Retry.
    - 401: redirect to sign-in or let middleware handle; show message if surfaced.
    - 500: generic error message with Retry.
  - Concurrency: cancel in-flight requests on query change via `AbortController`.

## 8. User Interactions
- Changing search text updates `search` after debounce; resets page to 1; triggers refetch.
- Opening FilterModal → Apply: validates, updates `min/max` fields, resets page to 1; closes modal.
- Reset in FilterModal or clicking FilterButton reset: clears filters and refetches.
- Changing sortBy or sortOrder: updates query; resets page to 1; refetch.
- Clicking a page number or next/prev: updates `page` with clamping; refetch.
- Clicking a recipe card: navigates to `/recipes/{id}`.
- EmptyState CTA: navigates to `/recipes/new`.
- Retry in ErrorBanner: reissues the last request.

## 9. Conditions and Validation
- Query constraints (client-side mirror of API):
  - `page >= 1`; `pageSize ∈ [1,50]`.
  - `sortBy ∈ {"created_at","updated_at","title"}`; `sortOrder ∈ {"asc","desc"}`.
  - When provided: `minKcal, maxKcal, minProtein, maxProtein >= 0` and `min ≤ max` per dimension.
  - Search: trimmed; empty string omitted from query.
- UI enforcement:
  - Disable Apply button in modal while invalid; show inline error text near offending input.
  - Disable prev/next at boundaries; `aria-disabled` applied.
  - Skeletons shown while `isLoading`.
  - Active filter count badge computed by number of defined filter fields.

## 10. Error Handling
- Network/500: Show generic error banner with Retry.
- 400 validation error: Show API error details if available; keep current UI state so user can adjust inputs.
- 401 Unauthorized: Expect middleware to prevent access; if surfaced client-side, show message and link to sign-in.
- Empty results (200 with `data: []`): Show `EmptyState` when no recipes overall; if filters produce zero results but there are recipes overall, show zero-results message with “Clear filters” action.
- Abort errors: Silently ignore if superseded by a newer request.

## 11. Implementation Steps
1. Create Astro page `src/pages/recipes.astro` with container shell and client:load React island mount for `RecipeListView`.
2. Implement `RecipeListView.tsx` in `src/components/` using React 19 and Tailwind 4.
3. Add `useDebouncedValue`, `useQueryStateSync`, and `useRecipes` hooks (co-locate in `src/components/` or `src/lib/` as appropriate).
4. Build `SearchBar`, `FilterButton`, `FilterModal`, `SortControls`, `ResultsSummary`, `RecipeGrid`, `RecipeCard`, `RecipeCardSkeleton`, `Pagination`, and `ErrorBanner` components in `src/components/` (UI primitives may use shadcn/ui from `src/components/ui`).
5. Wire toolbar interactions to update `query` and URL; ensure debounced search; reset page to 1 on search, filter, or sort changes.
6. Integrate API fetch in `useRecipes` with `AbortController`, error handling, and loading skeletons.
7. Map `RecipeDTO` to `RecipeListItemVM` (compute `updatedAtRelative`).
8. Implement accessibility: labels for inputs/selects, `aria-label` on pagination, `aria-current` on active page, keyboard-focusable cards.
9. Implement `EmptyState` with CTA to `/recipes/new`.
10. Add tests where applicable (component unit tests for validation logic and URL sync behavior).
11. Manual QA: verify empty state, valid/invalid filters, sorting, pagination, back/forward navigation, and error states.
