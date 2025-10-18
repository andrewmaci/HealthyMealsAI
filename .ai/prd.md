# Product Requirements Document (PRD) - HealthyMealsAI

## 1. Product Overview
HealthyMealsAI is an MVP web application that helps users adapt culinary recipes to their personal nutritional needs and dietary requirements. The app enables users to create and manage text-based recipes, define dietary preferences and macro targets, and generate AI-assisted adaptations that align recipes with individual goals. The system keeps version history with restore, enforces clear operational limits for reliability, and instruments key product analytics to measure success.

Primary users include athletes and users with dietary constraints who need quick, reliable ways to tailor recipes to their preferences and macro goals.

Key capabilities in MVP:
- Recipe CRUD for text-only recipes
- User profile with dietary preferences and macro/calorie targets
- AI adaptation against a single goal per run, with explanation and diff
- Versioning of AI-adapted recipes with restore
- Authentication via Supabase email/password
- Analytics instrumentation for core funnel and weekly KPI

Out of scope for MVP:
- Importing recipes from a URL
- Rich media (photos, videos)
- Sharing or social features


## 2. User Problem
Adapting online recipes to specific dietary needs is time-consuming and error-prone. Users must manually reconcile allergens/dislikes, macro targets, and calorie constraints—often resulting in compromises or repeated trial-and-error. HealthyMealsAI streamlines this process by capturing user preferences and macro goals, then using AI to produce feasible adaptations that are as close as possible to targets, with transparent explanations and versioning for easy compare/restore.

Pain points addressed:
- Difficulty removing allergens/disliked ingredients while maintaining palatability
- Effortful macro alignment (calories, protein, carbs, fat)
- Uncertainty about differences vs. the original recipe and why changes were made
- Lack of simple history/restore for iterative experimentation
- No central place to store personal recipes and preferences


## 3. Functional Requirements

3.1 Authentication and Access Control
- Users can sign up, log in, and log out using Supabase email/password.
- Protected routes: recipe management, adaptation, and preferences require authentication.
- Sessions persist securely; unauthorized users are redirected to sign in.

3.2 User Preferences and Targets
- Users can save allergens, intolerances, disliked ingredients, preferred cuisines, and macro/calorie targets.
- Allergen/dislike lists use keyword/synonym matching; conflicts are hard-blocked on save and on AI proposals.
- Macro/calorie targets are treated as range goals (±10%).

3.3 Recipe Management (Text-only)
- Users can create, read, update, and delete recipes.
- Required fields: title, servings, ingredients_text, steps_text, per-serving macros (kcal, protein, carbs, fat).
- Operational caps: up to 30 ingredients, 20 steps, and 2,000 characters per step.
- Basic validation for required fields and limits.

3.4 AI Adaptation
- Users select exactly one goal per adaptation run from: reduce calories, increase protein, adjust macro ratio, remove allergens/dislikes.
- The system enforces a limit of 10 AI adaptations per user per day.
- AI returns: proposed adapted recipe, explanation of changes, and a before/after diff with macro deltas.
- If targets cannot be fully met, the system returns the closest feasible adaptation with a clear delta summary and prompts to accept or revise the goal.
- Timeout at 30 seconds with friendly error copy and exponential backoff (system-level) on retries.

3.5 Versioning
- Accepted adaptations create a new version record auto-named as: v{n} · {goal} · {timestamp}.
- Show the latest 5 versions per recipe; users can restore any prior version.
- Restoration does not delete other versions.

3.6 Validation and Blocks
- Per-serving macros are required and validated for basic formatting and plausibility.
- Allergen/dislike conflicts are hard-blocked both when saving a recipe and when proposing/accepting AI adaptations.
- When validation or blocks occur, show actionable error messages.

3.7 Analytics and KPI
- Instrument events: sign_up, prefs_completed, recipe_created, ai_suggested, ai_accepted, recipe_saved.
- Store analytics in Supabase with a weekly KPI view/dashboard.
- Weekly “recipe generated” metric: ai_accepted OR recipe_created within 7 days.

3.8 Non-Functional Requirements (MVP)
- Reliability: enforce operational caps and adaptation/day quota.
- Performance: adaptation timeout at 30 seconds.
- Usability: clear explanations, diffs, and restore affordances.
- Security: rely on Supabase auth; protected routes; do not expose secrets in client.
- Accessibility/responsiveness: baseline web standards; details to be refined later.


## 4. Product Boundaries
- Not included in MVP: URL import, rich media, sharing, social features.
- Email verification, password complexity policy, and advanced rate limiting are deferred.
- Advanced analytics dashboards and alerts are limited to a simple weekly KPI view.
- Internationalization, extensive accessibility specs, and complex cuisine taxonomies are out of scope for MVP.


## 5. User Stories

US-001 Sign up with email/password
Description: As an unauthenticated user, I can create an account with email and password.
Acceptance Criteria:
- Given I am on the sign-up page, when I enter a valid email and password and submit, then my account is created in Supabase and I am authenticated.
- Given invalid input (malformed email, empty password), when I submit, then I see inline validation errors and no account is created.
- Given account creation succeeds, then an analytics event sign_up is recorded.

US-002 Log in with email/password
Description: As a registered user, I can authenticate using my credentials.
Acceptance Criteria:
- Given valid credentials, when I submit the login form, then I am authenticated and redirected to my recipes list.
- Given invalid credentials, when I submit, then I see an error and remain unauthenticated.

US-003 Log out
Description: As an authenticated user, I can log out and end my session.
Acceptance Criteria:
- Given I am authenticated, when I click log out, then my session ends and I am redirected to the sign-in page.

US-004 Protected routes require auth
Description: As an unauthenticated user, I cannot access recipe CRUD, adaptation, or preferences pages.
Acceptance Criteria:
- Given I am unauthenticated, when I navigate to a protected route, then I am redirected to sign in.

US-005 Create or update dietary preferences
Description: As an authenticated user, I can create and update my allergens, dislikes, cuisines, and macro/calorie targets.
Acceptance Criteria:
- Given I enter allergens/dislikes/cuisines and macro targets, when I save, then my preferences are persisted to my profile.
- Given missing or invalid fields (e.g., negative macros), when I save, then I see inline errors and nothing is saved.
- Given I save a complete profile, then an analytics event prefs_completed is recorded once per user.

US-006 Allergen/dislike matching and hard-block
Description: As a user, I am prevented from saving or accepting recipes that conflict with my allergens/dislikes.
Acceptance Criteria:
- Given my preferences include allergens or dislikes (with synonyms), when I attempt to save or accept an adaptation that includes a blocked ingredient, then I see a hard-block error and the action does not complete.

US-007 Create a recipe (text-only)
Description: As an authenticated user, I can create a recipe with required fields and limits.
Acceptance Criteria:
- Given I provide title, servings, ingredients_text, steps_text, and per-serving macros, when I save, then the recipe is created and visible in my list.
- Given any required field is missing or exceeds limits (30 ingredients, 20 steps, 2,000 chars/step), when I save, then I see validation errors and the recipe is not created.
- Given creation succeeds, then an analytics event recipe_created is recorded.

US-008 View my recipes
Description: As an authenticated user, I can view a list of my recipes and open details.
Acceptance Criteria:
- Given I am authenticated, when I navigate to my recipes, then I see my recipes sorted by most recent first.
- Given I select a recipe, then I can see details including current version and latest 5 versions (if any).

US-009 Edit a recipe
Description: As an authenticated user, I can update a recipe’s text fields and macros.
Acceptance Criteria:
- Given I open a recipe I own, when I edit fields within limits and save, then the recipe updates successfully.
- Given I exceed limits or remove required fields, when I save, then I see validation errors and no changes persist.

US-010 Delete a recipe
Description: As an authenticated user, I can delete a recipe I own.
Acceptance Criteria:
- Given I confirm deletion, when I delete, then the recipe is removed from my list and is no longer accessible.

US-011 Start AI adaptation (select one goal)
Description: As a user, I can initiate an AI adaptation by selecting exactly one goal.
Acceptance Criteria:
- Given I open a recipe, when I choose a single goal (reduce calories, increase protein, adjust macro ratio, remove allergens/dislikes) and submit, then a request is sent to generate a proposal.
- Given I select more than one goal, when I submit, then I am prompted to choose exactly one.

US-012 Enforce daily adaptation quota
Description: As a user, I am limited to 10 AI adaptations per day.
Acceptance Criteria:
- Given I have remaining quota, when I start an adaptation, then it proceeds.
- Given I reached 10 adaptations today, when I start an adaptation, then I see a friendly quota-exceeded message and no new adaptation is generated.

US-013 Handle adaptation timeout and retry
Description: As a user, I receive friendly feedback if an adaptation exceeds 30 seconds.
Acceptance Criteria:
- Given an adaptation exceeds 30 seconds, when I wait, then I see a timeout message and suggestion to retry.
- System-level exponential backoff is applied on retries without duplicating user-visible requests.

US-014 Show adaptation proposal with explanation and diff
Description: As a user, I can review the proposed adapted recipe with explanation and before/after diff.
Acceptance Criteria:
- Given the AI returns a proposal, when I open the result, then I see the adapted recipe, explanation of changes, and before/after differences including macro deltas.
- Given the goal cannot be fully met, when I view the proposal, then I see the closest feasible version and a clear delta summary to targets.

US-015 Accept adaptation and create new version
Description: As a user, I can accept an adaptation to save a new version.
Acceptance Criteria:
- Given I accept a proposal, when I confirm, then a new version is saved with auto-name v{n} · {goal} · {timestamp} and becomes the current version.
- Given acceptance succeeds, then analytics events ai_accepted and recipe_saved are recorded.

US-016 Reject adaptation
Description: As a user, I can reject an adaptation proposal and keep the current recipe unchanged.
Acceptance Criteria:
- Given a proposal is displayed, when I reject it, then no new version is created and I remain on the current version.

US-017 View version history and restore
Description: As a user, I can view the latest 5 versions and restore any prior version.
Acceptance Criteria:
- Given a recipe has versions, when I open version history, then I see the latest 5 with auto-names.
- Given I select restore, when I confirm, then the chosen version becomes current without deleting other versions.

US-018 Prevent allergen/dislike conflicts in proposals
Description: As a user, I do not receive proposals that include blocked ingredients.
Acceptance Criteria:
- Given my preferences, when the system prepares a proposal, then conflicting ingredients are not included; otherwise the proposal is hard-blocked with an error.

US-019 Validate per-serving macros on recipe save
Description: As a user, I must provide plausible per-serving macros to save a recipe.
Acceptance Criteria:
- Given macros are missing or non-numeric/negative, when I save, then I see validation errors and the recipe is not saved.
- Given macros are present and valid, when I save, then the recipe is saved.

US-020 Analytics instrumentation
Description: As a product team, I can track core events and compute weekly KPI.
Acceptance Criteria:
- Given user actions occur (sign_up, prefs_completed, recipe_created, ai_suggested, ai_accepted, recipe_saved), when they happen, then corresponding events are persisted in Supabase analytics.
- Given a weekly view, when I query the KPI view, then I can compute “weekly recipe generated” = ai_accepted OR recipe_created within 7 days per user.

US-021 Unauthorized access redirect
Description: As an unauthenticated user, I am redirected from protected endpoints.
Acceptance Criteria:
- Given I try to access preferences, recipe CRUD, or adaptation pages without a session, when I navigate, then I am redirected to sign-in.

US-022 Basic security controls
Description: As a user, my data is accessible only through authenticated sessions.
Acceptance Criteria:
- Given I am authenticated, when I use protected routes, then my session is validated by Supabase.
- Given I am not authenticated, when I call protected APIs, then I receive an unauthorized response and no data is returned.

US-023 Operational caps enforcement on edit/update
Description: As a user, I cannot exceed ingredient/step limits when editing.
Acceptance Criteria:
- Given I exceed 30 ingredients, 20 steps, or 2,000 chars per step, when I save edits, then I see validation errors and the update is blocked.

US-024 Single-goal enforcement for adaptation
Description: As a user, I must choose only one goal per adaptation.
Acceptance Criteria:
- Given multiple goals are selected, when I submit, then I am prompted to choose exactly one before proceeding.


## 6. Success Metrics
- Preferences completion rate: target 90% of signed-up users complete dietary preferences (prefs_completed / sign_up).
- Weekly recipe generation: target 75% of users generate ≥1 recipe/week, measured by ai_accepted OR recipe_created within a 7-day window per user.
- AI adaptation acceptance rate: percentage of adaptation proposals accepted (ai_accepted / ai_suggested).
- Reliability indicators (operational limits): proportion of requests within caps and under 30s timeout.
- Data captured via Supabase analytics events and aggregated in a weekly KPI view/dashboard.


