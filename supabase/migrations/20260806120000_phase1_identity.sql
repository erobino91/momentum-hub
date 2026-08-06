-- Fase 1: identidade e liberação de acesso (entitlements)
--
-- Três tabelas: `orgs` (o cliente da agência), `memberships` (quem pertence a quê)
-- e `entitlements` (qual módulo está liberado para qual org).
--
-- Regra de isolamento: todo dado é filtrado por org. Quem tem papel `agency`
-- (a equipe da MMT) enxerga todas as orgs, via policy separada.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.membership_role as enum ('owner', 'staff', 'agency');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.module_key as enum ('dashboard', 'bio', 'fila', 'cmv');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  logo_url      text,
  primary_color text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  org_id     uuid not null references public.orgs (id) on delete cascade,
  role       public.membership_role not null default 'staff',
  created_at timestamptz not null default now(),
  unique (user_id, org_id)
);

create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists memberships_org_id_idx  on public.memberships (org_id);

create table if not exists public.entitlements (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade,
  module     public.module_key not null,
  enabled    boolean not null default false,
  config     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, module)
);

create index if not exists entitlements_org_id_idx on public.entitlements (org_id);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orgs_touch_updated_at on public.orgs;
create trigger orgs_touch_updated_at
  before update on public.orgs
  for each row execute function public.touch_updated_at();

drop trigger if exists entitlements_touch_updated_at on public.entitlements;
create trigger entitlements_touch_updated_at
  before update on public.entitlements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helpers de tenancy
--
-- SECURITY DEFINER para ler `memberships` sem disparar a RLS da própria
-- `memberships` — sem isso a policy chamaria a função que consulta a tabela
-- que dispara a policy, em recursão infinita. Mesmo padrão de
-- `current_restaurant_id()` no Fila de Espera.
-- ---------------------------------------------------------------------------

create or replace function public.current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.memberships where user_id = auth.uid();
$$;

-- Conveniência para o app: a org "atual" do usuário. No v1 um cliente pertence
-- a uma org só; se um dia pertencer a várias, o app escolhe e as policies
-- continuam usando `current_org_ids()`.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id
  from public.memberships
  where user_id = auth.uid()
  order by created_at
  limit 1;
$$;

-- É alguém da agência? Papel `agency` em qualquer org.
create or replace function public.is_agency()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and role = 'agency'
  );
$$;

revoke execute on function public.current_org_ids() from anon;
revoke execute on function public.current_org_id()  from anon;
revoke execute on function public.is_agency()       from anon;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Leitura: a própria org, ou tudo se for agência.
-- Escrita: só agência. O cliente nunca cria org, membership ou entitlement.
-- ---------------------------------------------------------------------------

alter table public.orgs         enable row level security;
alter table public.memberships  enable row level security;
alter table public.entitlements enable row level security;

-- orgs
drop policy if exists orgs_select on public.orgs;
create policy orgs_select on public.orgs
  for select to authenticated
  using (id in (select public.current_org_ids()) or public.is_agency());

drop policy if exists orgs_write_agency on public.orgs;
create policy orgs_write_agency on public.orgs
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

-- memberships
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select to authenticated
  using (org_id in (select public.current_org_ids()) or public.is_agency());

drop policy if exists memberships_write_agency on public.memberships;
create policy memberships_write_agency on public.memberships
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

-- entitlements
drop policy if exists entitlements_select on public.entitlements;
create policy entitlements_select on public.entitlements
  for select to authenticated
  using (org_id in (select public.current_org_ids()) or public.is_agency());

drop policy if exists entitlements_write_agency on public.entitlements;
create policy entitlements_write_agency on public.entitlements
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());
