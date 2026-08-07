-- Fase 4 — Fila de Espera, migration 1 de 8.
--
-- Cópia de `Fila de Espera/supabase/migrations/20260617153000_phase2_auth_tenant.sql`.
-- O corpo do SQL é o original, sem alteração; o que muda é a inserção das linhas
-- `-- ------` que o `aplicar-migration.mjs` usa para cortar o arquivo em seções
-- (a API de gestão devolve 400 sem corpo quando recebe o arquivo inteiro).
--
-- `restaurants` continua sendo a tabela de tenancy do Fila. A partir da migration
-- 8, `restaurants.id` é obrigatoriamente o `orgs.id` do mesmo cliente.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

-- 4.1 restaurants (tenant table)
create table public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  logo_url      text,
  primary_color text,
  created_at    timestamptz not null default now()
);

-- 4.2 profiles (extends auth.users)
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete restrict,
  name          text not null,
  role          text not null default 'host',
  created_at    timestamptz not null default now()
);

create index profiles_restaurant_id_idx on public.profiles (restaurant_id);

-- ---------------------------------------------------------------------------
-- Função auxiliar
-- ---------------------------------------------------------------------------

-- Helper: the restaurant_id of the currently authenticated user.
-- SECURITY DEFINER so it reads profiles without triggering the profiles RLS
-- policy (which would otherwise recurse).
create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- 4.6 Row Level Security
alter table public.restaurants enable row level security;
alter table public.profiles    enable row level security;

-- restaurants: a user can only read/update their own restaurant.
create policy restaurants_select_own on public.restaurants
  for select using (id = public.current_restaurant_id());

create policy restaurants_update_own on public.restaurants
  for update using (id = public.current_restaurant_id())
  with check (id = public.current_restaurant_id());

-- profiles: a user can read profiles within their own restaurant,
-- and update only their own row. Inserts are done server-side (service role).
create policy profiles_select_same_tenant on public.profiles
  for select using (restaurant_id = public.current_restaurant_id());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
