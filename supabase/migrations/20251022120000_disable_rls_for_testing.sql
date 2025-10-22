-- ============================================================================
-- migration:    disable rls policies for local testing
-- description:  turns off row level security on user-owned tables so that the
--               api can function without authenticated requests during early
--               development.
-- dependencies: 20251020134323_init_schema
-- notes:        DO NOT deploy to production. Remember to re-enable RLS before
--               shipping any real environment build.
-- ============================================================================

alter table if exists public.profiles disable row level security;
alter table if exists public.recipes disable row level security;
alter table if exists public.adaptation_logs disable row level security;

-- optional sanity check: explicitly allow anon/all access to simplify testing.
-- remove or tighten before re-enabling rls.
revoke all on public.profiles from anon;
revoke all on public.recipes from anon;
revoke all on public.adaptation_logs from anon;

grant all on public.profiles to anon;
grant all on public.recipes to anon;
grant all on public.adaptation_logs to anon;

-- ============================================================================
-- end of migration.
-- ============================================================================

