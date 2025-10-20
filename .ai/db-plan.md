1. List of tables with their columns, data types, and constraints

### Table: auth.users (Supabase managed)
- id UUID PRIMARY KEY (managed by Supabase Auth)
- email, encrypted password, and other auth-specific metadata (managed outside this schema)

### Table: profiles
- id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
- allergens TEXT[] NOT NULL DEFAULT '{}' CHECK (array_position(allergens, NULL) IS NULL)
- disliked_ingredients TEXT[] NOT NULL DEFAULT '{}' CHECK (array_position(disliked_ingredients, NULL) IS NULL)
- timezone TEXT NULL CHECK (timezone IS NULL OR timezone <> '')
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

### Table: recipes
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- title TEXT NOT NULL CHECK (char_length(title) > 0)
- servings INTEGER NOT NULL CHECK (servings > 0)
- kcal NUMERIC(10,2) NOT NULL CHECK (kcal >= 0)
- protein NUMERIC(10,2) NOT NULL CHECK (protein >= 0)
- carbs NUMERIC(10,2) NOT NULL CHECK (carbs >= 0)
- fat NUMERIC(10,2) NOT NULL CHECK (fat >= 0)
- recipe_text TEXT NOT NULL CHECK (char_length(recipe_text) BETWEEN 1 AND 10000)
- last_adaptation_explanation TEXT NULL CHECK (char_length(last_adaptation_explanation) <= 2000)
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

### Table: adaptation_logs
- id UUID PRIMARY KEY DEFAULT gen_random_uuid()
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
- recipe_id UUID NULL REFERENCES recipes(id) ON DELETE SET NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

2. Relationships between tables
- auth.users 1 — 1 profiles via profiles.id
- auth.users 1 — N recipes via recipes.user_id
- auth.users 1 — N adaptation_logs via adaptation_logs.user_id
- recipes 1 — N adaptation_logs via adaptation_logs.recipe_id (nullable to retain history after recipe deletion)

3. Indexes
- CREATE INDEX recipes_user_id_idx ON recipes(user_id);
- CREATE INDEX adaptation_logs_user_id_idx ON adaptation_logs(user_id);
- CREATE INDEX adaptation_logs_user_id_created_at_idx ON adaptation_logs(user_id, created_at DESC);

4. PostgreSQL policies (RLS)
- Table: profiles
  - Enable row level security.
  - Policy `profiles_select_own`: SELECT USING (id = auth.uid()).
  - Policy `profiles_update_own`: UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid()).
- Table: recipes
  - Enable row level security.
  - Policy `recipes_select_own`: SELECT USING (user_id = auth.uid()).
  - Policy `recipes_modify_own`: INSERT WITH CHECK (user_id = auth.uid()); UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid()); DELETE USING (user_id = auth.uid()).
- Table: adaptation_logs
  - Enable row level security.
  - Policy `adaptation_logs_select_own`: SELECT USING (user_id = auth.uid()).
  - Policy `adaptation_logs_insert_own`: INSERT WITH CHECK (user_id = auth.uid()).

5. Additional notes
- Enable extension `pgcrypto` to support `gen_random_uuid()`.
- Attach a reusable trigger (e.g., `set_updated_at()`) on `profiles` and `recipes` to maintain `updated_at` on updates.
- Profiles are auto-created via a SECURITY DEFINER function that runs on new user signup to guarantee 1:1 relationship with auth.users.
- Analytics events are not stored in this MVP per planning decisions; revisit once analytics provider is chosen.
