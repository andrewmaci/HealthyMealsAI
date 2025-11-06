-- ============================================================================
-- migration:    re-enable row level security
-- description:  restores RLS policies on all user-owned tables after testing phase.
--               revokes broad anon permissions and reinstates granular policies
--               for authenticated users only.
-- dependencies: 20251020134323_init_schema, 20251022120000_disable_rls_for_testing
-- affected:     public.profiles, public.recipes, public.adaptation_logs
-- notes:        this migration should be deployed before any production use.
--               all policies follow the principle of least privilege.
-- ============================================================================

-- revoke broad anon permissions that were granted for testing.
-- this ensures unauthenticated requests cannot access user data.
revoke all on public.profiles from anon;
revoke all on public.recipes from anon;
revoke all on public.adaptation_logs from anon;

-- re-enable row level security on all user-owned tables.
-- after this, only explicit policies will grant access.
alter table public.profiles enable row level security;
alter table public.recipes enable row level security;
alter table public.adaptation_logs enable row level security;

-- ============================================================================
-- profiles policies
-- rationale: users should only access their own profile data.
--            no delete policy needed as profiles are tied to auth.users lifecycle.
-- ============================================================================

-- policy: allow authenticated users to view their own profile
drop policy if exists profiles_select_own_authenticated on public.profiles;
create policy profiles_select_own_authenticated
    on public.profiles
    for select
    to authenticated
    using (id = auth.uid());

comment on policy profiles_select_own_authenticated on public.profiles is 
    'authenticated users can view their own profile data only';

-- policy: allow authenticated users to update their own profile
drop policy if exists profiles_update_own_authenticated on public.profiles;
create policy profiles_update_own_authenticated
    on public.profiles
    for update
    to authenticated
    using (id = auth.uid())
    with check (id = auth.uid());

comment on policy profiles_update_own_authenticated on public.profiles is 
    'authenticated users can update their own profile, cannot change ownership';

-- policy: allow authenticated users to insert their own profile
drop policy if exists profiles_insert_self_authenticated on public.profiles;
create policy profiles_insert_self_authenticated
    on public.profiles
    for insert
    to authenticated
    with check (id = auth.uid());

comment on policy profiles_insert_self_authenticated on public.profiles is 
    'authenticated users can create their own profile row during signup';

-- policy: allow authenticated users to delete their own profile
-- included for completeness, though cascade from auth.users typically handles this
drop policy if exists profiles_delete_own_authenticated on public.profiles;
create policy profiles_delete_own_authenticated
    on public.profiles
    for delete
    to authenticated
    using (id = auth.uid());

comment on policy profiles_delete_own_authenticated on public.profiles is 
    'authenticated users can delete their own profile if needed';

-- ============================================================================
-- recipes policies
-- rationale: recipes are private to the user who created them.
--            full crud operations allowed on own recipes only.
-- ============================================================================

-- policy: allow authenticated users to view their own recipes
drop policy if exists recipes_select_own_authenticated on public.recipes;
create policy recipes_select_own_authenticated
    on public.recipes
    for select
    to authenticated
    using (user_id = auth.uid());

comment on policy recipes_select_own_authenticated on public.recipes is 
    'authenticated users can view only their own recipes';

-- policy: allow authenticated users to create recipes
drop policy if exists recipes_insert_own_authenticated on public.recipes;
create policy recipes_insert_own_authenticated
    on public.recipes
    for insert
    to authenticated
    with check (user_id = auth.uid());

comment on policy recipes_insert_own_authenticated on public.recipes is 
    'authenticated users can create recipes, must set themselves as owner';

-- policy: allow authenticated users to update their own recipes
drop policy if exists recipes_update_own_authenticated on public.recipes;
create policy recipes_update_own_authenticated
    on public.recipes
    for update
    to authenticated
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

comment on policy recipes_update_own_authenticated on public.recipes is 
    'authenticated users can update their own recipes, cannot change ownership';

-- policy: allow authenticated users to delete their own recipes
drop policy if exists recipes_delete_own_authenticated on public.recipes;
create policy recipes_delete_own_authenticated
    on public.recipes
    for delete
    to authenticated
    using (user_id = auth.uid());

comment on policy recipes_delete_own_authenticated on public.recipes is 
    'authenticated users can delete their own recipes';

-- ============================================================================
-- adaptation_logs policies
-- rationale: adaptation logs are audit records tied to specific users.
--            users can view and create logs, but typically should not modify.
--            delete allowed for user data cleanup scenarios.
-- ============================================================================

-- policy: allow authenticated users to view their own adaptation logs
drop policy if exists adaptation_logs_select_own_authenticated on public.adaptation_logs;
create policy adaptation_logs_select_own_authenticated
    on public.adaptation_logs
    for select
    to authenticated
    using (user_id = auth.uid());

comment on policy adaptation_logs_select_own_authenticated on public.adaptation_logs is 
    'authenticated users can view their own adaptation history';

-- policy: allow authenticated users to create adaptation logs
drop policy if exists adaptation_logs_insert_own_authenticated on public.adaptation_logs;
create policy adaptation_logs_insert_own_authenticated
    on public.adaptation_logs
    for insert
    to authenticated
    with check (user_id = auth.uid());

comment on policy adaptation_logs_insert_own_authenticated on public.adaptation_logs is 
    'authenticated users can create adaptation log entries for their actions';

-- policy: allow authenticated users to delete their own adaptation logs
-- useful for gdpr compliance and user data cleanup
drop policy if exists adaptation_logs_delete_own_authenticated on public.adaptation_logs;
create policy adaptation_logs_delete_own_authenticated
    on public.adaptation_logs
    for delete
    to authenticated
    using (user_id = auth.uid());

comment on policy adaptation_logs_delete_own_authenticated on public.adaptation_logs is 
    'authenticated users can delete their own adaptation logs if needed';

-- ============================================================================
-- verification queries (optional - for manual testing)
-- uncomment to verify policies are active after migration:
-- ============================================================================
-- select tablename, policyname, permissive, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;

-- ============================================================================
-- end of migration.
-- ============================================================================

