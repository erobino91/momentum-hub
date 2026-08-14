-- Fase 6.1 — os números do dashboard saem do projeto antigo e passam a morar aqui.
--
-- No projeto antigo (`mynolirdauvkubxvlddt`) a identidade do cliente era a tabela
-- `clients`, e o `slug` dela era a senha: quem soubesse o slug abria
-- `dash.html?c=<slug>` sem login. Aqui a identidade é `orgs`, e quem manda é a
-- sessão — `periods.client_id` vira `dashboard_periods.org_id`. O slug some do
-- caminho crítico junto com o link adivinhável.
--
-- `clients.is_active` não vem: no portal, empresa que não deve mais ver o
-- dashboard é empresa sem membership. Um segundo interruptor só criaria a chance
-- de os dois discordarem — mesma lição que matou `entitlements.enabled`.
--
-- `clients.active_sections` também não vira coluna: é configuração do módulo
-- dashboard e vai para `module_config.config.secoes`, onde o `dashboard_slug` já
-- morava.

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table if not exists public.dashboard_periods (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.orgs (id) on delete cascade,
  period_date date not null,

  -- Faturamento
  fat_total    numeric default 0,
  fat_proprio  numeric default 0,
  fat_ifood    numeric default 0,
  fat_mesa     numeric,
  fat_delivery numeric,

  -- Pedidos
  pedidos_mesa     integer,
  pedidos_delivery integer,

  -- Funil do cardápio próprio
  cp_visitas    integer default 0,
  cp_views      integer default 0,
  cp_sacola     integer default 0,
  cp_revisao    integer default 0,
  cp_concluidos integer default 0,

  -- Funil do iFood
  if_visitas    integer default 0,
  if_views      integer default 0,
  if_sacola     integer default 0,
  if_revisao    integer default 0,
  if_concluidos integer default 0,

  -- Mídia paga e CRM
  meta_invest         numeric default 0,
  meta_vendas         numeric default 0,
  google_invest       numeric default 0,
  google_vendas       numeric default 0,
  google_visitas_loja integer default 0,
  google_rotas        integer default 0,
  crm_invest          numeric default 0,
  crm_vendas          numeric default 0,

  -- Observações do mês: `raw` é o que a agência escreve, `polished` é o texto
  -- que o cliente lê.
  obs_raw      text,
  obs_polished text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Um mês por empresa. No projeto antigo não havia essa trava e nada impedia
  -- duas linhas do mesmo mês, que o dashboard somaria como meses diferentes.
  unique (org_id, period_date)
);

create index if not exists dashboard_periods_org_idx
  on public.dashboard_periods (org_id, period_date desc);

drop trigger if exists dashboard_periods_touch_updated_at on public.dashboard_periods;
create trigger dashboard_periods_touch_updated_at
  before update on public.dashboard_periods
  for each row execute function public.touch_updated_at();

comment on table public.dashboard_periods is
  'Um mês de resultado por empresa. Origem: tabela `periods` do projeto antigo '
  'do dashboard, migrada na Fase 6 com client_id -> org_id.';

-- ---------------------------------------------------------------------------
-- RLS
--
-- Leitura: a própria empresa (é o dashboard dela) ou a agência.
-- Escrita: só agência — é ela quem fecha o mês.
-- ---------------------------------------------------------------------------

alter table public.dashboard_periods enable row level security;

drop policy if exists dashboard_periods_select on public.dashboard_periods;
create policy dashboard_periods_select on public.dashboard_periods
  for select to authenticated
  using (org_id in (select public.current_org_ids()) or public.is_agency());

drop policy if exists dashboard_periods_write_agency on public.dashboard_periods;
create policy dashboard_periods_write_agency on public.dashboard_periods
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

-- ---------------------------------------------------------------------------
-- Bucket dos logos
--
-- Público na leitura, como era no projeto antigo: é a logo que aparece no topo
-- do dashboard, e URL assinada aqui só traria expiração para quebrar em cache.
-- Escrita, só agência.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

drop policy if exists logos_leitura_publica on storage.objects;
create policy logos_leitura_publica on storage.objects
  for select to public
  using (bucket_id = 'logos');

drop policy if exists logos_escrita_agencia on storage.objects;
create policy logos_escrita_agencia on storage.objects
  for all to authenticated
  using (bucket_id = 'logos' and public.is_agency())
  with check (bucket_id = 'logos' and public.is_agency());
