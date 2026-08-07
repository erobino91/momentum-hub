-- Fase 4 — Fila de Espera, migration 7 de 8.
--
-- Cópia de `Fila de Espera/supabase/migrations/20260804120000_partner_readonly_role.sql`,
-- com as linhas `-- ------` inseridas. Corpo do SQL sem alteração.
--
-- É o papel `partner` do André: lê tudo do próprio restaurante, não escreve nada.

-- ---------------------------------------------------------------------------
-- Função auxiliar
-- ---------------------------------------------------------------------------

-- Read-only partner access.
-- Adds a 'partner' profile role that can SELECT everything inside its own
-- restaurant but cannot INSERT / UPDATE / DELETE anything. Existing 'host'
-- users keep full CRUD — every write policy below is the previous one plus a
-- role check.

-- Helper: role of the currently authenticated user. SECURITY DEFINER for the
-- same reason as current_restaurant_id() — reading profiles inside a profiles
-- policy would recurse.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

-- ── customers ──────────────────────────────────────────────────────────────
drop policy customers_insert on public.customers;
drop policy customers_update on public.customers;
drop policy customers_delete on public.customers;

create policy customers_insert on public.customers
  for insert with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );
create policy customers_update on public.customers
  for update using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  ) with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );
create policy customers_delete on public.customers
  for delete using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );

-- ---------------------------------------------------------------------------
-- environments
-- ---------------------------------------------------------------------------

-- ── environments ───────────────────────────────────────────────────────────
drop policy environments_insert on public.environments;
drop policy environments_update on public.environments;
drop policy environments_delete on public.environments;

create policy environments_insert on public.environments
  for insert with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );
create policy environments_update on public.environments
  for update using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  ) with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );
create policy environments_delete on public.environments
  for delete using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );

-- ---------------------------------------------------------------------------
-- waiting_entries
-- ---------------------------------------------------------------------------

-- ── waiting_entries ────────────────────────────────────────────────────────
drop policy waiting_entries_insert on public.waiting_entries;
drop policy waiting_entries_update on public.waiting_entries;
drop policy waiting_entries_delete on public.waiting_entries;

create policy waiting_entries_insert on public.waiting_entries
  for insert with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );
create policy waiting_entries_update on public.waiting_entries
  for update using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  ) with check (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );
create policy waiting_entries_delete on public.waiting_entries
  for delete using (
    restaurant_id = public.current_restaurant_id()
    and public.current_user_role() = 'host'
  );

-- ---------------------------------------------------------------------------
-- restaurants e profiles
-- ---------------------------------------------------------------------------

-- ── restaurants ────────────────────────────────────────────────────────────
drop policy restaurants_update_own on public.restaurants;

create policy restaurants_update_own on public.restaurants
  for update using (
    id = public.current_restaurant_id() and public.current_user_role() = 'host'
  ) with check (
    id = public.current_restaurant_id() and public.current_user_role() = 'host'
  );

-- ── profiles ───────────────────────────────────────────────────────────────
-- A partner must not edit its own profile row — it carries the role column,
-- so an update there would be a privilege escalation.
drop policy profiles_update_own on public.profiles;

create policy profiles_update_own on public.profiles
  for update using (
    id = auth.uid() and public.current_user_role() = 'host'
  ) with check (
    id = auth.uid() and public.current_user_role() = 'host'
  );

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

-- ── audit_logs ─────────────────────────────────────────────────────────────
drop policy audit_logs_insert on public.audit_logs;

create policy audit_logs_insert on public.audit_logs
  for insert with check (
    restaurant_id = public.current_restaurant_id()
    and user_id = auth.uid()
    and public.current_user_role() = 'host'
  );
