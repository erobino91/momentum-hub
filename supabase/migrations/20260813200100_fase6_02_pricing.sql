-- Fase 6.2 — precificação iFood.
--
-- Ferramenta interna da agência: a partir do preço de balcão do produto, calcula
-- o preço a subir no iFood em três fases, embutindo taxa extra (%), campanha
-- inteligente, entrega grátis e cupom.
--
-- **A conta não muda nesta migração** e as unidades são as do projeto antigo:
-- `taxa_extra` é percentual, `campanha`/`entrega`/`cupom` são reais. Foi
-- conferido com o Luis em 13/08/2026 — o `5` que aparece em `campanha` para
-- todo cliente é R$ 5,00, não 5%.
--
-- Ao contrário do dashboard, **o cliente não lê estas tabelas**: é a margem da
-- operação dele sendo calculada pela agência, e não há tela de cliente para
-- isso. Por isso a policy de select é `is_agency()` e não tem ramo de org.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table if not exists public.pricing_products (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs (id) on delete cascade,
  name         text not null,
  preco_balcao numeric not null,
  created_at   timestamptz not null default now()
);

create index if not exists pricing_products_org_idx
  on public.pricing_products (org_id, name);

create table if not exists public.pricing_config (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.orgs (id) on delete cascade unique,
  taxa_extra numeric not null default 0,  -- percentual
  campanha   numeric not null default 0,  -- reais
  entrega    numeric not null default 0,  -- reais
  cupom      numeric not null default 0,  -- reais
  updated_at timestamptz not null default now()
);

drop trigger if exists pricing_config_touch_updated_at on public.pricing_config;
create trigger pricing_config_touch_updated_at
  before update on public.pricing_config
  for each row execute function public.touch_updated_at();

comment on table public.pricing_config is
  'Variáveis da precificação iFood por empresa. taxa_extra em %, os outros três '
  'em R$ — as unidades são as do projeto antigo e a conta segue igual: '
  'f1 = balcao * (1 + taxa/100) + campanha; f2 = f1 + entrega; f3 = f2 + cupom.';

-- ---------------------------------------------------------------------------
-- RLS — só agência, leitura e escrita
-- ---------------------------------------------------------------------------

alter table public.pricing_products enable row level security;
alter table public.pricing_config   enable row level security;

drop policy if exists pricing_products_agencia on public.pricing_products;
create policy pricing_products_agencia on public.pricing_products
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

drop policy if exists pricing_config_agencia on public.pricing_config;
create policy pricing_config_agencia on public.pricing_config
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());
