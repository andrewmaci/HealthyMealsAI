<conversation_summary>
<decisions>
Create profiles with strict 1:1 relation to auth.users using profiles.id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE.
Store allergens and disliked_ingredients as TEXT[] NOT NULL DEFAULT '{}'.
Store macros as separate columns: kcal, protein, carbs, fat as NUMERIC(10,2) NOT NULL CHECK (value >= 0).
servings is INTEGER NOT NULL CHECK (servings > 0).
title is TEXT NOT NULL CHECK (char_length(title) > 0).
recipe_text is TEXT NOT NULL CHECK (char_length(recipe_text) BETWEEN 1 AND 10000).
profiles.timezone is TEXT NULL storing IANA names; app defaults to UTC if NULL and prompts user to set timezone.
Enforce quota via adaptation_logs rows (insert on success only) counted per user-local day.
Add adaptation_logs: id UUID PK DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), recipe_id UUID NULL REFERENCES recipes(id) ON DELETE SET NULL.
Enable RLS: profiles with USING (id = auth.uid()); recipes/adaptation_logs with USING (user_id = auth.uid()).
Indexes: FK indexes on profiles.id, recipes.user_id, adaptation_logs.user_id; composite index on adaptation_logs(user_id, created_at).
Add recipes.last_adaptation_explanation TEXT NULL CHECK (char_length(last_adaptation_explanation) <= 2000).
Add created_at TIMESTAMPTZ DEFAULT now() and updated_at TIMESTAMPTZ DEFAULT now() on mutable tables; maintain updated_at via a generic trigger.
Use UUID PKs for recipes with DEFAULT gen_random_uuid() (enable pgcrypto).
Use a SECURITY DEFINER function/trigger to auto-create a profiles row on new user signup.
Do not create analytics_events for MVP; defer richer analytics.
Do not store adaptation notes in DB for MVP.
Keep allergens/dislikes normalized in profiles (no denormalization into recipes).
For performance, exclude recipe_text from list queries; fetch only in detail view.
Cascade deletes from auth.users to profiles, recipes, and adaptation_logs. If a recipe is deleted, set adaptation_logs.recipe_id to NULL (retain quota history).
Quota decrements only on successful AI responses; failed attempts do not log or decrement.
</decisions>
<matched_recommendations>
Create profiles linked 1:1 to auth.users. [Accepted]
Use TEXT[] for allergens/dislikes. [Accepted]
Store macros as individual columns (not JSON). [Accepted]
Use adaptation_logs(user_id, created_at) for quotas with composite index. [Accepted]
Store timezone as IANA TEXT. [Accepted]
Enable RLS with USING (auth.uid() = user_id) (profiles uses id = auth.uid()). [Accepted]
Define FKs with ON DELETE CASCADE. [Accepted]
Add FK indexes; composite on adaptation_logs(user_id, created_at). [Accepted]
Use NUMERIC(10,2) for macros with non-negative checks. [Accepted]
Enforce recipe_text length <= 10,000 via CHECK. [Accepted]
Require non-empty title via CHECK. [Accepted]
servings as INTEGER with CHECK (servings > 0). [Accepted]
Keep profile data normalized (no denormalization). [Accepted]
Add recipes.last_adaptation_explanation (TEXT). [Accepted]
Add updated_at with a reusable trigger. [Accepted]
Add analytics_events table. [Rejected for MVP]
Store adaptation notes in adaptation_logs. [Rejected for MVP]
profiles.id = UUID PK and FK to auth.users(id). [Accepted]
Default arrays to '{}' to avoid NULL. [Accepted]
Add recipe_id to adaptation_logs. [Accepted with modification: NULLable, ON DELETE SET NULL]
Use SECURITY DEFINER for the profile creation trigger. [Accepted]
Allow NULL/empty recipe_text. [Rejected; enforce NOT NULL and length >= 1]
Use UUID PKs for recipes. [Accepted; gen_random_uuid()]
Limit last_adaptation_explanation length (e.g., 2000). [Accepted; 2000]
</matched_recommendations>
<database_planning_summary>
Main schema requirements
profiles: id UUID PK FK→auth.users ON DELETE CASCADE, allergens TEXT[] NOT NULL DEFAULT '{}', disliked_ingredients TEXT[] NOT NULL DEFAULT '{}', timezone TEXT NULL, timestamps with updated_at trigger; RLS id = auth.uid().
recipes: id UUID PK DEFAULT gen_random_uuid(), user_id UUID NOT NULL FK→auth.users ON DELETE CASCADE, title TEXT NOT NULL CHECK (char_length(title) > 0), servings INTEGER NOT NULL CHECK (servings > 0), macros kcal/protein/carbs/fat NUMERIC(10,2) NOT NULL CHECK >= 0, recipe_text TEXT NOT NULL CHECK (1 <= char_length(recipe_text) <= 10000), last_adaptation_explanation TEXT NULL CHECK (char_length(...) <= 2000), timestamps with updated_at trigger; RLS user_id = auth.uid().
adaptation_logs: id UUID PK DEFAULT gen_random_uuid(), user_id UUID NOT NULL FK→auth.users ON DELETE CASCADE, recipe_id UUID NULL FK→recipes ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), indexes on user_id and (user_id, created_at); RLS user_id = auth.uid().
Extensions: enable pgcrypto for gen_random_uuid().
Key entities and relationships
auth.users(id) 1:1 profiles(id) (PK=FK).
auth.users(id) 1:N recipes(user_id).
auth.users(id) 1:N adaptation_logs(user_id).
recipes(id) 1:N adaptation_logs(recipe_id) (optional link; retained with SET NULL on recipe delete).
Security and scalability
RLS on all user-scoped tables; minimal and selective queries (exclude recipe_text in lists).
Cascading deletes from users; preserve quota history when recipes are deleted.
Composite index on adaptation_logs(user_id, created_at) for quota checks; FK indexes elsewhere.
Quota uses UTC created_at plus stored timezone to determine user-local day.
Generic updated_at trigger ensures consistent modification timestamps.
Precise numeric types for macros ensure correctness and validation at the DB layer.
Unresolved or clarifications
None; all previously pending items have been decided as above.
</database_planning_summary>
<unresolved_issues>
None
</unresolved_issues>
</conversation_summary>