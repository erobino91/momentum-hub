-- Fase 6.3 — módulo de Lives.
--
-- Painel da agência ↔ Supabase como fila de mensagens ↔ `lives-worker` (Node +
-- ffmpeg, na máquina do Luis) → RTMPS do Instagram. Não há servidor de API: o
-- worker enxerga o banco com `service_role`, então **a RLS destas tabelas não
-- vale para ele** — vale para o painel.
--
-- Duas correções em relação ao projeto antigo:
--
--   1. Lá a policy era `to authenticated using (true)`: qualquer usuário logado
--      lia `live_sessions`, e `stream_key` é a chave da transmissão do
--      Instagram do cliente. Aqui é `is_agency()` — no hub existe cliente
--      logado, o que lá não existia.
--   2. O bucket `materials` era **público**: o mp4 de qualquer cliente abria por
--      link direto, sem sessão. Nasce privado; o worker baixa com a chave
--      secreta e o painel exibe por URL assinada.

-- ---------------------------------------------------------------------------
-- Materiais (os vídeos)
-- ---------------------------------------------------------------------------

create table if not exists public.live_materials (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade,
  label      text not null,
  source_url text not null,          -- upload cru
  file_url   text,                   -- convertido pelo worker
  status     text not null default 'ready',  -- processing | ready | error
  created_at timestamptz not null default now()
);

create index if not exists live_materials_org_idx on public.live_materials (org_id);

-- ---------------------------------------------------------------------------
-- Sessões de live
-- ---------------------------------------------------------------------------

create table if not exists public.live_sessions (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs (id) on delete cascade,
  -- `set null`: apagar um material não pode apagar o histórico de transmissão.
  material_id    uuid references public.live_materials (id) on delete set null,
  stream_url     text,               -- edge RTMPS, muda a cada transmissão
  stream_key     text not null,      -- segredo: nunca sai em log
  status         text not null default 'starting', -- starting|live|ending|ended|error
  started_at     timestamptz,
  ended_at       timestamptz,
  auto_cutoff_at timestamptz,        -- corte de segurança (~3h50)
  error_message  text,
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now()
);

create index if not exists live_sessions_org_idx    on public.live_sessions (org_id);
create index if not exists live_sessions_status_idx on public.live_sessions (status);

comment on column public.live_sessions.stream_key is
  'Chave da transmissão do Instagram. Segredo — o worker nunca a escreve em log '
  'e nenhuma tela de cliente lê esta tabela.';

-- ---------------------------------------------------------------------------
-- RLS — só agência. O worker entra por `service_role` e passa por cima.
-- ---------------------------------------------------------------------------

alter table public.live_materials enable row level security;
alter table public.live_sessions  enable row level security;

drop policy if exists live_materials_agencia on public.live_materials;
create policy live_materials_agencia on public.live_materials
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

drop policy if exists live_sessions_agencia on public.live_sessions;
create policy live_sessions_agencia on public.live_sessions
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

-- ---------------------------------------------------------------------------
-- Bucket dos vídeos — privado
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do update set public = false;

drop policy if exists materials_agencia on storage.objects;
create policy materials_agencia on storage.objects
  for all to authenticated
  using (bucket_id = 'materials' and public.is_agency())
  with check (bucket_id = 'materials' and public.is_agency());
