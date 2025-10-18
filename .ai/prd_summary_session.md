<conversation_summary>
<decisions>
Target users: athletes and users with dietary constraints; no prioritization required.
Auth: web-only using Supabase email/password; further auth policies deferred.
Recipe input: free-text ingredients and steps.
Nutrition data: users must provide per-serving macros (kcal, protein, carbs, fat) with basic validation and ±10–15% tolerance.
Preferences: allergens/dislikes as hard blocks; macro/calorie targets as range goals (±10%).
AI adaptation: single-goal per run (reduce calories, increase protein, adjust macro ratio, remove allergens/dislikes); create a new version; user must accept before saving; include explanation of changes.
If goals can’t be fully met: return closest feasible version with delta summary and “accept anyway or revise goal.”
Versioning: auto-name “v{n} · {goal} · {timestamp},” show latest 5 per recipe, allow Restore without deletion.
Analytics: events = sign_up, prefs_completed, recipe_created, ai_suggested, ai_accepted, recipe_saved; “weekly recipe generated” = ai_accepted OR recipe_created within 7 days; store in Supabase analytics table with weekly KPI view and simple dashboard.
Operational limits: cap 30 ingredients, 20 steps, 2,000 chars/step; limit 10 AI adaptations/user/day; 30s timeout; exponential backoff; friendly error copy.
</decisions>
<matched_recommendations>
Implement keyword/blocklist allergen matcher with synonyms; hard-block conflicts on save and proposals.
Offer four adaptation goals; enforce one-goal-per-adaptation for MVP.
Provide closest-feasible adaptation with delta summary when tolerance unmet; allow accept/revise.
Use version auto-naming and Restoration; show latest 5 versions.
Store schema: title, servings, ingredients_text, steps_text, per-serving macros, optional cuisine, created_by, version_of, created_at.
Require user-provided per-serving macros with range validation and ±10–15% tolerance.
Instrument analytics events and define weekly KPI; log to Supabase with weekly SQL view and simple dashboard.
Enforce operational limits (ingredients/steps/length); apply adaptation/day quota, timeout, backoff, error UX.
UX flow: Onboard (preferences) → Create Recipe → Adapt → Review (diff + explanation) → Accept & Save.
Supabase email/password for auth (email verification/password policy deferred).
</matched_recommendations>
<prd_planning_summary>
Main functional requirements:
User accounts via Supabase email/password.
Preference management: allergens, intolerances, disliked ingredients, cuisines, macro/calorie targets; hard-block allergens/dislikes.
Recipe CRUD with free-text ingredients and steps; per-serving macros required; field caps to control size.
AI adaptation with four selectable goals (one at a time); produce explanation and before/after diff; create new version pending user acceptance.
Version history: auto-named, show latest 5, restore any version.
Validation: tolerance checks (±10–15%); closest-feasible fallback with deltas; hard-block allergen conflicts.
Analytics: capture defined events; compute “weekly recipe generated” metric; store in Supabase and surface via simple dashboard.
Operational controls: 10 adaptations/user/day, 30s timeout, exponential backoff, user-facing error messages.
Key user stories and paths:
As a user, I sign up/log in with email/password.
I complete my preferences (allergens, dislikes, cuisines, macro/calorie goals).
I create a recipe by entering title, servings, ingredients_text, steps_text, and per-serving macros.
I adapt a recipe by selecting a single goal; the app shows proposed changes with explanations and diffs.
I accept the proposal to save a new version or reject it to keep the current one.
I view version history and restore prior versions.
My activity is tracked for progress metrics.
Success criteria and measurement:
90% of users complete dietary preferences: measured via prefs_completed / sign_up.
75% of users generate ≥1 recipe/week: measured via ai_accepted OR recipe_created per user in 7 days.
Supporting metrics via Supabase analytics events and weekly KPI view/dashboard.
Areas requiring further clarification:
Auth policies: email verification, password requirements, rate limiting/lockout specifics.
Accessibility/responsiveness standards and minimum device breakpoints.
Allergen synonym source/coverage and language handling.
Data quality for user-provided macros (additional validation guidance or helper UI).
Analytics dashboard scope (which charts/filters) and alerting, if any.
</prd_planning_summary>
<unresolved_issues>
</unresolved_issues>
</conversation_summary>