-- Fase 3: bio / linktree próprio + rastreamento de cliques
--
-- Quatro tabelas. `link_pages` é a página (uma ou mais por org), `link_buttons`
-- os botões, `link_clicks` o registro de cada clique e `link_secrets` o token de
-- CAPI do pixel do cliente.
--
-- Duas regras que valem para o resto do arquivo:
--
-- 1. **Nada aqui é legível pelo papel `anon`.** A página pública não consulta o
--    banco pelo navegador: quem lê é o servidor do hub, com a chave secreta. Sem
--    policy para `anon` significa que a chave publishable, que é pública por
--    natureza, não abre nenhuma destas tabelas.
-- 2. **`link_secrets` não tem policy nenhuma, nem para `authenticated`.** O
--    `capi_token` é credencial do BM do cliente: só a chave secreta, server-side,
--    consegue ler. Nem o dono da página vê o próprio token de volta.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.link_pages (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade,
  slug       text not null unique,
  title      text not null,
  bio        text,
  avatar_url text,
  theme      jsonb not null default '{}'::jsonb,
  pixel_id   text,
  active     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint link_pages_slug_formato check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$')
);

create index if not exists link_pages_org_id_idx on public.link_pages (org_id);

create table if not exists public.link_buttons (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.link_pages (id) on delete cascade,
  label      text not null,
  url        text not null,
  icon       text,
  position   integer not null default 0,
  active     boolean not null default true,
  starts_at  timestamptz,
  ends_at    timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint link_buttons_url_http check (url ~* '^https?://')
);

create index if not exists link_buttons_page_pos_idx
  on public.link_buttons (page_id, position);

-- `button_id` fica `on delete set null`: apagar um botão não pode apagar o
-- histórico de cliques dele, senão o relatório do mês muda sozinho.
create table if not exists public.link_clicks (
  id         bigint generated always as identity primary key,
  page_id    uuid not null references public.link_pages (id) on delete cascade,
  button_id  uuid references public.link_buttons (id) on delete set null,
  rotulo     text,
  clicked_at timestamptz not null default now(),
  ip_hash    text,
  ua         text,
  referrer   text,
  fbclid     text,
  country    text,
  city       text
);

create index if not exists link_clicks_page_data_idx
  on public.link_clicks (page_id, clicked_at desc);
create index if not exists link_clicks_button_data_idx
  on public.link_clicks (button_id, clicked_at desc);

create table if not exists public.link_secrets (
  page_id    uuid primary key references public.link_pages (id) on delete cascade,
  capi_token text not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

drop trigger if exists link_pages_touch_updated_at on public.link_pages;
create trigger link_pages_touch_updated_at
  before update on public.link_pages
  for each row execute function public.touch_updated_at();

drop trigger if exists link_buttons_touch_updated_at on public.link_buttons;
create trigger link_buttons_touch_updated_at
  before update on public.link_buttons
  for each row execute function public.touch_updated_at();

drop trigger if exists link_secrets_touch_updated_at on public.link_secrets;
create trigger link_secrets_touch_updated_at
  before update on public.link_secrets
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Helper de posse
--
-- SECURITY DEFINER pelo mesmo motivo de `current_org_ids()`: a policy de
-- `link_buttons` precisa consultar `link_pages`, e sem isso a leitura dispararia
-- a policy de `link_pages`, que chamaria a função de novo.
-- ---------------------------------------------------------------------------

create or replace function public.owns_link_page(p_page uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.link_pages p
    where p.id = p_page
      and (p.org_id in (select public.current_org_ids()) or public.is_agency())
  );
$$;

revoke execute on function public.owns_link_page(uuid) from anon;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Diferente da Fase 1: aqui o **cliente escreve**. Bio e botões são conteúdo
-- dele, não configuração da agência. O que ele não faz é trocar a página de org
-- nem escrever clique (`link_clicks` é só leitura; quem grava é a chave
-- secreta, que passa por cima da RLS).
-- ---------------------------------------------------------------------------

alter table public.link_pages   enable row level security;
alter table public.link_buttons enable row level security;
alter table public.link_clicks  enable row level security;
alter table public.link_secrets enable row level security;

drop policy if exists link_pages_select on public.link_pages;
create policy link_pages_select on public.link_pages
  for select to authenticated
  using (org_id in (select public.current_org_ids()) or public.is_agency());

drop policy if exists link_pages_write on public.link_pages;
create policy link_pages_write on public.link_pages
  for all to authenticated
  using (org_id in (select public.current_org_ids()) or public.is_agency())
  with check (org_id in (select public.current_org_ids()) or public.is_agency());

drop policy if exists link_buttons_select on public.link_buttons;
create policy link_buttons_select on public.link_buttons
  for select to authenticated
  using (public.owns_link_page(page_id));

drop policy if exists link_buttons_write on public.link_buttons;
create policy link_buttons_write on public.link_buttons
  for all to authenticated
  using (public.owns_link_page(page_id))
  with check (public.owns_link_page(page_id));

drop policy if exists link_clicks_select on public.link_clicks;
create policy link_clicks_select on public.link_clicks
  for select to authenticated
  using (public.owns_link_page(page_id));

-- `link_secrets` fica sem policy de propósito: RLS ligada e nenhuma regra = nega
-- para todo mundo que não seja a chave secreta.
revoke all on public.link_secrets from anon, authenticated;
