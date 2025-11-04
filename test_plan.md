# HealthyMealsAI Test Plan

## 1. Introduction and Testing Objectives
HealthyMealsAI aims to let authenticated users personalize dietary profiles, manage text-based recipes, and run AI-powered adaptations using OpenRouter. QA will validate functional correctness, data integrity with Supabase, AI integration robustness, accessibility, and non-functional qualities before major releases.

## 2. Scope of Testing
- In scope: Astro pages in `src/pages`, React components under `src/components`, API routes in `src/pages/api`, service logic in `src/lib/services`, Supabase migrations, and middleware session handling.
- In scope: Environment variance between local (RLS disabled) and staging/prod (RLS enabled).
- Out of scope: Third-party UI library internals from shadcn/ui, external OpenRouter service beyond contract mocking, analytics transport beyond console logging.
- Partial scope: Tailwind-driven visual regressions covered by spot checks and optional visual diff tooling.

## 3. Types of Tests
- Unit tests for service modules (`recipe.service.ts`, `profile.service.ts`, `adaptation.service.ts`, `openrouter.service.ts`) and React hooks (`useRecipeDetail`, `useQuota`, `useSaveProfile`).
- Component tests for critical React UI (`SignInForm`, `RecipeListView`, `AdaptationWizard`, `ProfileForm`) using Testing Library.
- Integration/API tests hitting Astro API routes with a seeded Supabase test schema, verifying Zod validation, authentication guards, and Supabase interactions.
- End-to-end tests with Playwright covering sign-in, profile updates, recipe CRUD, adaptation flows, and middleware redirects.
- Contract tests simulating OpenRouter responses to ensure JSON schema handling, idempotency cache behavior, and error mapping.
- Non-functional tests: basic performance smoke (response times for key APIs), accessibility sweeps (axe) on primary pages, security checks for RLS-enabled environments.

## 4. Test Scenarios for Key Functionalities
- **Auth & Session** Sign-in/up/reset flows, profile provisioning post-login, middleware redirects for authenticated vs guest users, logout API behavior.
- **Recipe CRUD** Create recipe validation against `RecipeCreateDtoSchema`, update with partial payloads and `return` query, delete confirmation via query/body, unauthorized and cross-user access attempts.
- **Recipe Discovery UI** Query parsing in `parseQueryFromSearchParams`, pagination and sorting, filter modal sanitization, debounce behavior, empty/error states in `RecipeListView`.
- **Profile Management** GET/PUT profile concurrency using `If-Unmodified-Since`, validation for allergens/disliked/timezone, conflict handling, alert messaging, tag input UX.
- **Adaptation Workflow** POST adaptation with idempotency-key header, quota exhaustion, AI timeout/unprocessable mapping, history listing filters, acceptance endpoint updating recipe and explanation, wizard UI signals and toast feedback.
- **Quota & Analytics** `/api/adaptations/quota` timezone window calculation, daily reset edges (DST), analytics events triggered on request/success/accept, middleware rate-limiting fallback.

## 5. Test Environment
- Node.js 22.14.0 with npm; Astro dev server (`npm run dev`) for local functional runs.
- Supabase local instance started via `supabase start`, seeded with migrations; toggle RLS on/off to mirror prod vs dev.
- Environment variables: `SUPABASE_URL`, `SUPABASE_KEY`, `OPENROUTER_API_KEY`, optional `OPENROUTER_*` tuning, `DAILY_ADAPTATION_LIMIT`.
- Mock OpenRouter service using MSW or custom Express stub for deterministic responses; fallback to live service only in gated staging tests.
- Browsers: Chromium (Playwright default), plus smoke on WebKit/Firefox for layout checks.

## 6. Testing Tools
- Vitest with Testing Library for unit/component tests; ts-node/ESM compatible.
- Playwright for E2E automation and accessibility assertions.
- MSW for API mocking in tests; Supertest for direct API route validation.
- Supabase CLI for migration management and test database resets.
- ESLint/Prettier integrated into CI for static quality gates; optional axe-core CLI for accessibility.
- GitHub Actions pipeline executing lint, unit, integration, and E2E suites.

## 7. Test Schedule
- Week 1: Environment setup, Supabase seed data, unit tests for services/hooks.
- Week 2: Component and API integration tests, OpenRouter contract suite, start Playwright smoke paths.
- Week 3: Expand E2E coverage, accessibility/performance checks, regression on RLS-enabled snapshot, bug triage.
- Ongoing: Automated nightly smoke run and per-PR lint/unit pipeline; pre-release full regression including manual exploratory.

## 8. Test Acceptance Criteria
- 100% pass rate on unit, integration, and E2E suites in CI.
- Critical user journeys (auth, profile update, recipe CRUD, adaptation success/accept) verified on Chromium and at least one secondary browser.
- No open high-severity defects; medium defects triaged with mitigation or fix.
- Supabase migrations validated against RLS-on environment; data integrity checks pass.
- Accessibility smoke (axe) yields no critical issues on primary pages; API latency under agreed thresholds (≤500 ms for recipe/profile endpoints under nominal load).

## 9. Roles and Responsibilities
- QA Lead: maintain test plan, oversee execution, own defect triage, sign-off releases.
- QA Engineer(s): implement automated tests, conduct exploratory sessions, manage test data.
- Developers: provide unit tests for new code, support integration debugging, review defects.
- DevOps: maintain CI/CD pipelines, manage Supabase instances, coordinate environment configs.
- Product Owner: prioritize defects, approve release readiness alongside QA.

## 10. Bug Reporting Procedures
- Capture issues in GitHub Issues with template including environment, steps, expected vs actual, logs/console output, related commit hash.
- Tag severity (Critical/High/Medium/Low) and component label (`api-auth`, `ui-recipes`, `supabase`, `ai-adaptation`).
- Attach Playwright trace/video or network logs for E2E regressions; include Supabase query IDs when applicable.
- QA Lead reviews daily, assigns owner, and updates status through verification; resolved defects require regression test reference before closure.

