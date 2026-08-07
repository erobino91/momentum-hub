-- Fase 4 — Fila de Espera, migration 2 de 8.
--
-- Cópia de `Fila de Espera/supabase/migrations/20260617154500_phase3_data_model.sql`,
-- com as linhas `-- ------` inseridas para o `aplicar-migration.mjs` cortar em seções.
-- Corpo do SQL sem alteração.

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------

-- ── 4.3 customers ──────────────────────────────────────────────────────────
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null,
  phone         text not null,
  date_of_birth date,
  email         text,
  visit_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (restaurant_id, phone) -- phone is the per-restaurant lookup key
);

create index customers_restaurant_id_idx on public.customers (restaurant_id);

-- ---------------------------------------------------------------------------
-- environments
-- ---------------------------------------------------------------------------

-- ── 4.4 environments ───────────────────────────────────────────────────────
create table public.environments (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null,
  active        boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index environments_restaurant_order_idx
  on public.environments (restaurant_id, display_order);

-- ---------------------------------------------------------------------------
-- waiting_entries
-- ---------------------------------------------------------------------------

-- ── 4.5 waiting_entries ────────────────────────────────────────────────────
create table public.waiting_entries (
  id                     uuid primary key default gen_random_uuid(),
  restaurant_id          uuid not null references public.restaurants (id) on delete cascade,
  customer_id            uuid not null references public.customers (id) on delete cascade,
  environment_id         uuid references public.environments (id) on delete set null, -- null = no preference
  party_size             integer not null check (party_size >= 1),
  estimated_wait_minutes integer not null check (estimated_wait_minutes >= 0),
  table_number           text,
  observation            text,
  status                 text not null default 'waiting'
                           check (status in ('waiting', 'called', 'gave_up')),
  created_at             timestamptz not null default now(), -- arrival time
  called_at              timestamptz,
  gave_up_at             timestamptz
);

-- Active queue lookup: by restaurant + status, ordered by arrival.
create index waiting_entries_active_idx
  on public.waiting_entries (restaurant_id, status, created_at);
create index waiting_entries_customer_idx on public.waiting_entries (customer_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------

-- ── 9.3 audit_logs ─────────────────────────────────────────────────────────
create table public.audit_logs (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  action        text not null,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);

create index audit_logs_restaurant_idx on public.audit_logs (restaurant_id, created_at);

-- ---------------------------------------------------------------------------
-- Trigger de updated_at
-- ---------------------------------------------------------------------------

-- ── Triggers ───────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Trigger de called_at / gave_up_at
-- ---------------------------------------------------------------------------

-- Auto-set called_at / gave_up_at when status first transitions (§4.5).
create or replace function public.set_status_timestamps()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'called'
     and old.status is distinct from 'called'
     and new.called_at is null then
    new.called_at = now();
  end if;
  if new.status = 'gave_up'
     and old.status is distinct from 'gave_up'
     and new.gave_up_at is null then
    new.gave_up_at = now();
  end if;
  return new;
end;
$$;

create trigger waiting_entries_status_timestamps
  before update on public.waiting_entries
  for each row execute function public.set_status_timestamps();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- ── 4.6 Row Level Security ─────────────────────────────────────────────────
alter table public.customers       enable row level security;
alter table public.environments    enable row level security;
alter table public.waiting_entries enable row level security;
alter table public.audit_logs      enable row level security;

-- customers: full CRUD within own restaurant
create policy customers_select on public.customers
  for select using (restaurant_id = public.current_restaurant_id());
create policy customers_insert on public.customers
  for insert with check (restaurant_id = public.current_restaurant_id());
create policy customers_update on public.customers
  for update using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy customers_delete on public.customers
  for delete using (restaurant_id = public.current_restaurant_id());

-- environments: full CRUD within own restaurant
create policy environments_select on public.environments
  for select using (restaurant_id = public.current_restaurant_id());
create policy environments_insert on public.environments
  for insert with check (restaurant_id = public.current_restaurant_id());
create policy environments_update on public.environments
  for update using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy environments_delete on public.environments
  for delete using (restaurant_id = public.current_restaurant_id());

-- waiting_entries: full CRUD within own restaurant
create policy waiting_entries_select on public.waiting_entries
  for select using (restaurant_id = public.current_restaurant_id());
create policy waiting_entries_insert on public.waiting_entries
  for insert with check (restaurant_id = public.current_restaurant_id());
create policy waiting_entries_update on public.waiting_entries
  for update using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
create policy waiting_entries_delete on public.waiting_entries
  for delete using (restaurant_id = public.current_restaurant_id());

-- audit_logs: append-only — read own restaurant, insert own rows. No update/delete.
create policy audit_logs_select on public.audit_logs
  for select using (restaurant_id = public.current_restaurant_id());
create policy audit_logs_insert on public.audit_logs
  for insert with check (
    restaurant_id = public.current_restaurant_id() and user_id = auth.uid()
  );
