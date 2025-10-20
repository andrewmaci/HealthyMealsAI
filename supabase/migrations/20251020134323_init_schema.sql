-- ============================================================================
-- migration:    init schema for healthy meals ai
-- description:  creates core domain tables (profiles, recipes, adaptation_logs),
--               installs required extensions, helper triggers, indexes, and
--               row level security policies aligned with supabase best practices.
-- dependencies: none
-- notes:        reviewed for safe defaults, defensive constraints, and
--               granular RLS coverage for authenticated users.
-- ============================================================================

-- ensure required crypto extension exists for uuid generation helpers.
create extension if not exists "pgcrypto";

-- ============================================================================
-- helper function: set_updated_at
-- purpose:   automatically refreshes the updated_at column on row updates.
-- behavior:  skips execution when the new row is unchanged or column absent.
-- safety:    defined as stable trigger, search_path locked to prevent hijacking.
-- ============================================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- guard: only touch rows where updated_at column exists and data changed.
    if new is distinct from old and (to_jsonb(new) ? 'updated_at') then
        new.updated_at = now();
    end if;
    return new;
end;
$$;

-- ============================================================================
-- table: profiles
-- maintains per-user dietary preferences and metadata.
-- ============================================================================
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    allergens text[] not null default '{}'::text[] check (array_position(allergens, null) is null),
    disliked_ingredients text[] not null default '{}'::text[] check (array_position(disliked_ingredients, null) is null),
    timezone text null check (timezone is null or timezone <> ''),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.profiles is 'per-user dietary metadata synchronized with auth.users.';

-- attach trigger to keep updated_at fresh on updates.
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.set_updated_at();

-- ============================================================================
-- table: recipes
-- stores user-authored or generated recipes with nutrition details.
-- ============================================================================
create table if not exists public.recipes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null check (char_length(title) > 0),
    servings integer not null check (servings > 0),
    kcal numeric(10, 2) not null check (kcal >= 0),
    protein numeric(10, 2) not null check (protein >= 0),
    carbs numeric(10, 2) not null check (carbs >= 0),
    fat numeric(10, 2) not null check (fat >= 0),
    recipe_text text not null check (char_length(recipe_text) between 1 and 10000),
    last_adaptation_explanation text null check (char_length(last_adaptation_explanation) <= 2000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.recipes is 'recipes curated per user including nutritional breakdown and ai adaptation context.';

-- keep updated_at synchronized on modifications.
drop trigger if exists set_recipes_updated_at on public.recipes;
create trigger set_recipes_updated_at
    before update on public.recipes
    for each row
    execute function public.set_updated_at();

-- ============================================================================
-- table: adaptation_logs
-- records historical adaptation events tied to users and optionally recipes.
-- ============================================================================
create table if not exists public.adaptation_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id uuid null references public.recipes(id) on delete set null,
    created_at timestamptz not null default now()
);

comment on table public.adaptation_logs is 'audit trail of recipe adaptation events for observability and analytics.';

-- ============================================================================
-- indexes tuned for primary access patterns.
-- ============================================================================
create index if not exists recipes_user_id_idx on public.recipes (user_id);
create index if not exists adaptation_logs_user_id_idx on public.adaptation_logs (user_id);
create index if not exists adaptation_logs_user_id_created_at_idx on public.adaptation_logs (user_id, created_at desc);

-- ============================================================================
-- row level security (RLS) setup
-- enables per-user isolation on all user-owned tables.
-- ============================================================================

-- enable rls on core tables.
alter table if exists public.profiles enable row level security;
alter table if exists public.recipes enable row level security;
alter table if exists public.adaptation_logs enable row level security;

-- profiles policies
-- deny-by-default for anon by omitting policies; authenticated users manage their own row.
drop policy if exists profiles_select_own_authenticated on public.profiles;
create policy profiles_select_own_authenticated
    on public.profiles
    for select
    to authenticated
    using (id = auth.uid());

drop policy if exists profiles_update_own_authenticated on public.profiles;
create policy profiles_update_own_authenticated
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

drop policy if exists profiles_insert_self_authenticated on public.profiles;
create policy profiles_insert_self_authenticated
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid());

-- recipes policies
drop policy if exists recipes_select_own_authenticated on public.recipes;
create policy recipes_select_own_authenticated
    on public.recipes
    for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists recipes_insert_own_authenticated on public.recipes;
create policy recipes_insert_own_authenticated
    on public.recipes
    for insert
    to authenticated
    with check (user_id = auth.uid());

drop policy if exists recipes_update_own_authenticated on public.recipes;
create policy recipes_update_own_authenticated
    on public.recipes
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists recipes_delete_own_authenticated on public.recipes;
create policy recipes_delete_own_authenticated
    on public.recipes
    for delete
    to authenticated
    using (user_id = auth.uid());

-- adaptation_logs policies
drop policy if exists adaptation_logs_select_own_authenticated on public.adaptation_logs;
create policy adaptation_logs_select_own_authenticated
    on public.adaptation_logs
    for select
    to authenticated
    using (user_id = auth.uid());

drop policy if exists adaptation_logs_insert_own_authenticated on public.adaptation_logs;
create policy adaptation_logs_insert_own_authenticated
    on public.adaptation_logs
    for insert
    to authenticated
    with check (user_id = auth.uid());

-- ============================================================================
-- automation: ensure every auth user gets a profile row.
-- uses security definer function triggered after account creation.
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- insert a profile for the new user if none exists.
    insert into public.profiles (id)
    values (new.id)
    on conflict (id) do nothing;
    return new;
end;
$$;

comment on function public.handle_new_user() is 'creates a default profile row after new auth user registration.';

-- ensure trigger exists on auth.users to call the provisioning function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- ============================================================================
-- end of migration.
-- ============================================================================

