<conversation_summary>
<decisions>
Scope: Only user-created recipes; no imports, media, or sharing. Recipe content stored as a single multiline recipe_text.
Data model: title (string), servings (number), per-serving macros (kcal, protein, carbs, fat as non-negative numbers), and recipe_text.
Preferences: Users declare allergens and disliked ingredients in profile settings; no per-recipe overrides.
AI goals: Four intents supported—remove allergens, remove disliked ingredients, reduce calories, increase protein; one goal per run.
Trigger/UX: “Adapt with AI” button opens a modal with the four goals and an optional notes field.
AI output contract: Strict JSON schema required: { recipe_text, macros: { kcal, protein, carbs, fat }, explanation }.
Review/Acceptance: No diff view; user reads the AI output, can view a collapsible “Original recipe” panel, then Accept. Acceptance overwrites the recipe (no versioning, no rollback) after a confirmation dialog.
Macros update: AI proposes updated per-serving macros with a short explanation; users may manually override before saving.
Safety/Disclaimers: System prompt instructs “never introduce allergens/dislikes.” Display a persistent “not medical advice/verify ingredients” notice in the modal and a small footer notice on results. No automated allergen double-checking; warning-only scope.
Quotas: Max 10 adaptations per user per calendar day; decrement on successful AI response only; show remaining count and disable with tooltip when exhausted; reset at user-local midnight (timestamps stored in UTC with user timezone).
Errors/Latency: Latency not a constraint. On errors/timeouts, instruct users to try again; failed attempts do not decrement quota.
Input limits: Cap recipe_text at 10,000 characters; notes at 500–1,000 characters; show counters and prevent over-limit submission.
Provider: Use OpenRouter; specific model/parameters to be determined later.
</decisions>
<matched_recommendations>
Enforce one-goal-per-adaptation via a modal with optional notes. (Accepted)
Require a strict JSON output schema to reliably update recipe_text and macros. (Accepted)
Store allergens/dislikes in profile only; no per-recipe overrides. (Accepted)
Require explicit acceptance with a confirmation dialog; overwrite without versioning or rollback. (Accepted)
Provide a collapsible “Original recipe” panel during review instead of a line-by-line diff. (Accepted)
Have AI propose updated per-serving macros with explanation; allow manual override before save. (Accepted)
Add strong system prompt guardrails and visible disclaimers; no automated allergen validation of AI output. (Accepted)
Enforce 10 adaptations/day, decrement on successful response, user-local reset, show remaining and disable when exhausted. (Accepted)
Cap input sizes (10k for recipe_text, 500–1,000 for notes) with counters and submission blocking. (Accepted)
On error/timeout, show retry guidance; do not decrement quota for failures. (Accepted)
</matched_recommendations>
<prd_planning_summary>
Main functional requirements:
Recipe management: Create, view, edit, and overwrite recipes with fields title, servings, per-serving macros, and multiline recipe_text.
Preferences: Profile sections to manage allergens and disliked ingredients used by AI guardrails.
AI adaptation: Modal-driven single-goal adaptation (remove allergens, remove dislikes, reduce calories, increase protein) with optional notes; provider via OpenRouter.
AI output handling: Accept strict JSON { recipe_text, macros, explanation }; render full recipe_text, show optional “Original recipe” panel, prefill macros with manual override.
Save flow: Acceptance overwrites current recipe after confirmation; no versioning or undo.
Safety/compliance: System prompt to avoid allergens/dislikes; visible disclaimers; no automated content validation.
Quotas/limits: 10 adaptations/day, decrement on successful response, user-local reset; input size caps with counters; clear error/retry UX.
Key user stories and paths:
As a user, I set my allergens and dislikes in profile settings.
I create a recipe by entering title, servings, recipe_text, and per-serving macros.
I click “Adapt with AI,” choose one goal, optionally add notes, and submit.
I review the AI’s proposed recipe_text, optionally reference the original, review proposed macros, optionally override them, and Accept.
I confirm overwrite and save the updated recipe.
I see remaining daily adaptations; when exhausted, the button is disabled with a tooltip.
Important success criteria and measurement (tentative):
Profile completion rate: % of signed-in users who set allergens/dislikes.
Adaptation engagement: % of active users who run ≥1 adaptation/week.
Acceptance rate: % of AI proposals that are accepted.
Time-to-first-adaptation: median time from first recipe creation to first adaptation.
Data collection: Instrument events (profile_updated, recipe_created, ai_requested, ai_succeeded, ai_accepted) with UTC timestamps and user timezone metadata.
Unresolved issues or areas requiring clarification:
OpenRouter model selection, temperature/top-p settings, and fallback strategy.
Final prompt templates and redaction rules (PII handling, logging, and retention).
Exact note length cap (choose 500 or 1,000) and any output-length caps from AI.
Error handling specifics (retry/backoff limits, user messaging copy).
Analytics stack details (provider, dashboard scope, KPI thresholds) and whether to include in MVP.
Authentication/authorization specifics and access controls (if any) for MVP.
</prd_planning_summary>
<unresolved_issues>
Select OpenRouter model and parameters; define fallback model(s).
Finalize prompt templates, PII redaction, logging, and data-retention policy.
Decide final notes cap (500 vs 1,000 chars) and any AI output length limits.
Specify error handling/retry/backoff policies and UI copy.
Define analytics implementation, events schema, dashboards, and target KPI thresholds.
Confirm auth/permissions approach for MVP (if required).
</unresolved_issues>
</conversation_summary>