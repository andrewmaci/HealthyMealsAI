# Product Requirements Document (PRD) - HealthyMealsAI

## 1. Product Overview
HealthyMeal is an MVP web application that enables users to create, manage, and adapt text-based recipes to their personal dietary needs using AI. The core value is helping users remove allergens or disliked ingredients and adjust macronutrients (calories and protein) in existing recipes with minimal friction.

MVP scope focuses on:
- Storing user-created recipes only (no imports, media, or sharing)
- Simple user accounts to associate recipes and preferences
- A user profile for allergens and disliked ingredients
- AI-based adaptation of recipes according to one selected goal at a time

Key assumptions and constraints:
- Recipe content is stored as a single multiline recipe_text field.
- Data model includes: title (string), servings (number), per-serving macros (kcal, protein, carbs, fat as non-negative numbers), and recipe_text (up to 10,000 chars).
- Profile stores allergens and disliked ingredients (no per-recipe overrides).
- AI provider is OpenRouter; exact model and parameters are to be determined.
- Adaptation runs support exactly one goal per run: remove allergens, remove disliked ingredients, reduce calories, or increase protein.
- Adaptation outputs must conform to a strict JSON schema: { recipe_text, macros: { kcal, protein, carbs, fat }, explanation }.
- Daily quota: maximum 10 successful adaptations per user per calendar day, reset at user-local midnight; failed attempts do not decrement quota.

## 2. User Problem
Users often discover appealing recipes online but struggle to align them with personal nutrition goals and dietary restrictions. Manually adapting recipes to remove allergens or disliked ingredients and to adjust calories or protein is time-consuming and error-prone. Users also want simple tracking of per-serving macros without complex tooling. HealthyMeal addresses these problems by providing an easy way to store personal recipes, capture dietary preferences, and use AI to propose safe, goal-aligned adaptations that users can review and accept.

## 3. Functional Requirements
3.1 Authentication and Authorization
- Users can create accounts, sign in, and sign out.
- Users can only access and modify their own recipes and profile data.
- Sessions must expire or be revocable; re-authentication required afterwards.

3.2 User Profile and Preferences
- Users can view and update allergens and disliked ingredients in a profile settings page.
- System prompt/guardrails for AI must prohibit introducing listed allergens/dislikes.
- The application should capture and store user timezone for quota resets and analytics.

3.3 Recipe Management (CRUD)
- Create, read, update, and delete text-based recipes with fields: title, servings, per-serving macros (kcal, protein, carbs, fat), and recipe_text.
- Field validation: non-empty title, servings as positive integer, macros as non-negative numbers, recipe_text length up to 10,000 characters.
- Deletion requires a confirmation step.
- List and detail views must be available; show an empty state when no recipes exist.

3.4 AI Adaptation Flow
- An Adapt with AI button opens a modal allowing exactly one selected goal per run: remove allergens, remove disliked ingredients, reduce calories, or increase protein.
- Modal includes an optional notes field with a character limit (500–1,000, final value configurable; default 500) and a live counter.
- On submission, show a loading state; prevent duplicate submissions.
- The system sends the recipe, profile preferences, selected goal, and optional notes to OpenRouter.
- The AI response must match the strict JSON schema: { recipe_text, macros: { kcal, protein, carbs, fat }, explanation }.
- On success, show the proposed recipe_text and proposed macros, along with the explanation. Also show a collapsible Original recipe panel.
- Users can manually override proposed macros before saving; validate for non-negative numbers.
- Acceptance requires a confirmation dialog; acceptance overwrites the existing recipe (no versioning or rollback).
- Declining or closing the modal leaves the recipe unchanged.

3.5 Quotas and Limits
- Enforce a maximum of 10 successful adaptations per user per calendar day.
- Display remaining adaptations in the UI; disable the Adapt with AI action when exhausted and show an explanatory tooltip.
- Reset quota at user-local midnight; store timestamps in UTC along with user timezone.
- Recipe_text limited to 10,000 characters; notes limited to the configured character cap (default 500). Block submissions over limits.

3.6 Errors and Latency Handling
- Latency is not a constraint for MVP; show a clear loading indicator while waiting.
- On AI error/timeout/invalid JSON response, show retry guidance; failed attempts do not decrement quota.
- If saving the accepted adaptation fails, show an error and do not overwrite the recipe.

3.7 Safety and Disclaimers
- The AI system prompt must instruct never to introduce allergens/dislikes.
- Show a persistent not medical advice/verify ingredients notice in the adaptation modal and a small footer notice on results.
- No automated allergen double-checking in the MVP; warnings only.

3.8 Analytics and Instrumentation
- Emit events with UTC timestamps and user timezone metadata: profile_updated, recipe_created, ai_requested, ai_succeeded, ai_accepted.
- Analytics stack details to be finalized; events should be queued or logged in a way that can be wired to the chosen provider later.

## 4. Product Boundaries
In scope (MVP):
- User accounts, personal profiles for allergens/dislikes, personal recipes only
- Text-only recipes; CRUD operations
- Single-goal AI adaptation per run with strict JSON output and acceptance overwrite
- Quotas, input limits, safety guardrails, and disclaimers

Out of scope (MVP):
- Importing recipes from URLs
- Rich media (photos, videos)
- Sharing recipes or social features
- Versioning or rollback of adaptations
- Automated allergen validation of AI output
- Detailed analytics dashboards and finalized analytics provider configuration

Dependencies and open items:
- Select OpenRouter model and parameters; define fallback strategy
- Finalize prompt templates, PII redaction, logging, and data-retention policy
- Decide final notes cap (500 vs 1,000 char) and any AI output length limits
- Specify error handling copy and retry/backoff policy details
- Confirm authentication/authorization specifics (MVP-level access controls)

## 5. User Stories
US-001
Title: User signs up
Description: As a new user, I want to create an account so that I can save my recipes and preferences.
Acceptance Criteria:
- Given I am on the sign-up page, when I provide valid required fields, then my account is created and I am signed in.
- When required fields are invalid, then I see validation errors and sign-up is blocked.

US-002
Title: User signs in
Description: As a returning user, I want to sign in so that I can access my recipes and preferences.
Acceptance Criteria:
- Given I have an account, when I provide valid credentials, then I am signed in and redirected to my recipes.
- When credentials are invalid, then I see an error and remain signed out.

US-003
Title: User signs out
Description: As a signed-in user, I want to sign out so that others cannot access my account on this device.
Acceptance Criteria:
- When I click sign out, then my session ends and I am redirected to the public landing page.

US-004
Title: Access control for recipes
Description: As a user, I want to ensure that only I can view or modify my recipes.
Acceptance Criteria:
- Given I am signed in, when I request any recipe, then only my own recipes are accessible; others return 404/forbidden.

US-005
Title: Session expiration
Description: As a user, I want inactive sessions to expire so that access is secure.
Acceptance Criteria:
- Given my session expires, when I return, then I am prompted to sign in again before accessing my recipes.

US-010
Title: View profile
Description: As a user, I want to view my profile so that I can see my allergens and dislikes.
Acceptance Criteria:
- When I open profile settings, then my saved allergens and disliked ingredients are displayed along with my timezone.

US-011
Title: Update allergens
Description: As a user, I want to update my list of allergens so that AI avoids them.
Acceptance Criteria:
- When I add or remove allergens and save, then the profile persists and an event profile_updated is emitted.

US-012
Title: Update disliked ingredients
Description: As a user, I want to update disliked ingredients so that AI avoids them.
Acceptance Criteria:
- When I add or remove disliked ingredients and save, then the profile persists and an event profile_updated is emitted.

US-013
Title: Profile completion prompt
Description: As a user, I want a prompt to complete my profile so that AI adaptations can respect my preferences.
Acceptance Criteria:
- When my allergens/dislikes are empty, then I see a non-blocking prompt encouraging completion.

US-020
Title: Create recipe
Description: As a user, I want to create a recipe so that I can store it for later.
Acceptance Criteria:
- Given required fields are valid (title, servings, macros non-negative, recipe_text <= 10,000), when I save, then the recipe is created and recipe_created is emitted.
- When inputs are invalid or over limits, then I see errors and cannot save.

US-021
Title: List recipes with empty state
Description: As a user, I want to see a list of my recipes or an empty state if none exist.
Acceptance Criteria:
- When I have no recipes, then I see an empty-state message and a create button.
- When I have recipes, then I see a list with titles and key details.

US-022
Title: View recipe detail
Description: As a user, I want to view a recipe’s full text and macros.
Acceptance Criteria:
- When I open a recipe, then I can read recipe_text and see per-serving macros and servings.

US-023
Title: Edit recipe
Description: As a user, I want to edit a recipe so that I can correct or update details.
Acceptance Criteria:
- When I change fields and save valid data, then the updates persist.
- Invalid changes or over-limit text are blocked with clear messages.

US-024
Title: Delete recipe with confirmation
Description: As a user, I want to delete a recipe only after confirming to avoid accidental loss.
Acceptance Criteria:
- When I click delete, then I see a confirmation; confirming deletes the recipe; canceling aborts.

US-025
Title: Validate recipe fields
Description: As a user, I want the app to validate fields so that data remains consistent.
Acceptance Criteria:
- Servings must be a positive integer; macros must be non-negative numbers; title must be non-empty; recipe_text must be <= 10,000 chars.

US-030
Title: Open Adapt with AI modal
Description: As a user, I want to open an adaptation modal so that I can choose one goal.
Acceptance Criteria:
- When I click Adapt with AI, then a modal opens with the four goals and an optional notes field with a live counter.

US-031
Title: Select goal and add notes
Description: As a user, I want to select one goal and optionally add notes to guide the AI.
Acceptance Criteria:
- Exactly one goal can be selected; notes cannot exceed the configured cap (default 500); submit is disabled when over the limit.

US-032
Title: Submit adaptation request
Description: As a user, I want to submit the adaptation and see progress.
Acceptance Criteria:
- When I submit, then I see a loading indicator and the submit action is disabled until a response or error.
- Event ai_requested is emitted once per submission attempt.

US-033
Title: Daily quota display and enforcement
Description: As a user, I want to see and respect my remaining daily adaptations.
Acceptance Criteria:
- Remaining adaptations are displayed; when 0, the Adapt with AI action is disabled with a tooltip.
- Quota decrements only on successful AI responses (ai_succeeded), resets at user-local midnight.

US-034
Title: Handle successful AI response
Description: As a user, I want to review the AI’s proposed recipe and macros before saving.
Acceptance Criteria:
- The modal shows proposed recipe_text, proposed macros, and explanation; the Original recipe panel is collapsible.
- Event ai_succeeded is emitted when a valid JSON response is received.

US-035
Title: Manually override proposed macros
Description: As a user, I want to adjust macros before saving.
Acceptance Criteria:
- I can edit macros; validation enforces non-negative numbers; invalid entries block saving with messages.

US-036
Title: Accept adaptation with overwrite confirmation
Description: As a user, I want to confirm acceptance and overwrite my recipe.
Acceptance Criteria:
- When I click Accept, then a confirmation dialog appears; confirming overwrites the recipe; event ai_accepted is emitted; canceling closes the dialog without changes.

US-037
Title: Decline or cancel adaptation
Description: As a user, I want to exit without changes if I am not satisfied.
Acceptance Criteria:
- Closing the modal or selecting decline leaves the recipe unchanged and does not decrement quota.

US-038
Title: Handle errors and timeouts
Description: As a user, I want clear guidance on errors and the ability to retry.
Acceptance Criteria:
- On AI error/timeout/invalid schema, then I see an error state with retry guidance; failed attempts do not decrement quota.

US-039
Title: Validate AI response schema
Description: As a system, I must accept only valid AI JSON responses.
Acceptance Criteria:
- Responses not matching { recipe_text, macros: { kcal, protein, carbs, fat }, explanation } are rejected with an error message and logged; no quota decrement.

US-040
Title: Enforce recipe text length limit
Description: As a user, I want a visible counter and blocking at 10,000 characters.
Acceptance Criteria:
- Live counter shows remaining characters; when over 10,000, save/submit is disabled and an error is displayed.

US-041
Title: Enforce notes length limit
Description: As a user, I want a visible counter and blocking at the configured cap.
Acceptance Criteria:
- Live counter shows remaining characters; when over the cap (default 500), submit is disabled and an error is displayed.

US-050
Title: Emit analytics events
Description: As a product team, we want key events emitted for measurement.
Acceptance Criteria:
- Events profile_updated, recipe_created, ai_requested, ai_succeeded, ai_accepted are emitted with UTC timestamp and user timezone; failures are logged.

US-060
Title: Display safety disclaimers
Description: As a user, I want safety notices so that I understand limitations.
Acceptance Criteria:
- The adaptation modal shows a persistent notice; the results view includes a footer notice.

US-061
Title: Prevent duplicate submissions
Description: As a user, I want the app to prevent accidental duplicate adaptation requests.
Acceptance Criteria:
- While a request is in-flight, the submit button is disabled and duplicate requests are ignored.

US-062
Title: Overwrite without versioning
Description: As a user, I understand that acceptance overwrites the recipe and cannot be undone.
Acceptance Criteria:
- After accepting, the previous version is not retained; no rollback or history is available.

US-063
Title: Timezone handling for quota reset
Description: As a user, I want quota reset at my local midnight.
Acceptance Criteria:
- The system stores my timezone and resets daily quota at my local midnight; timestamps are stored in UTC with timezone metadata.

## 6. Success Metrics
Primary success criteria:
- Profile completion: 90% of users have filled allergens/dislikes in their profile.
- Adaptation engagement: 75% of users generate one or more recipes per week or perform at least one adaptation per week (select one KPI for MVP and track both if possible).

Additional KPIs:
- Acceptance rate: Percentage of AI proposals that are accepted.
- Time-to-first-adaptation: Median time from first recipe creation to first adaptation.
- Daily quota utilization: Distribution of adaptations per user per day; percentage hitting the limit.
- Error rate: Percentage of adaptation attempts resulting in timeout/invalid schema/error.
- Data collection coverage: Percentage of sessions with all key events captured with timezone metadata.

Measurement notes:
- Instrument events with UTC timestamps and user timezone.
- Build lightweight dashboards or export logs to analyze KPIs post-MVP depending on chosen analytics stack.
