-- Dashboard: mês publicado deixa de ser "a linha existe"
--
-- Enquanto a regra foi "existe linha em `dashboard_periods`", nada podia criar
-- um mês além da tela de fechamento: a linha nascia visível. O sincronizador do
-- Meta precisa criar a linha para ter onde gravar `meta_invest` no dia 1, e com
-- a regra antiga o cliente veria, até alguém fechar o mês, um agosto com
-- "R$ 0,00" e "↓ -100,0 % vs mês anterior" — porque `n()` do dashboard converte
-- nulo em zero, e o gráfico despencaria junto.
--
-- É a mesma lição do bio, três semanas atrás: `link_pages` existia, `active`
-- era false, e o card aceso levava a um 404. Um recurso está pronto quando
-- existe **para valer**.
--
-- **Ninguém liga esta chave à mão.** `salvarPeriodo` grava `publicado = true`
-- sempre: publicar continua sendo o próprio ato de salvar o fechamento, como
-- era antes desta coluna existir. Chave que depende de alguém lembrar de virar
-- é como o mês fechado ficaria invisível sem ninguém notar.
--
-- Os 24 meses que já existem são todos fechamento de verdade (conferido: nenhum
-- tem os três `fat_*` nulos), então nascem `true` — a coluna entra sem apagar o
-- dashboard de ninguém. O `add` e o `update` moram na **mesma seção** de
-- propósito: separados, haveria um instante com todo mundo em `false`.

alter table public.dashboard_periods
  add column if not exists publicado boolean not null default false;

update public.dashboard_periods set publicado = true where publicado = false;

comment on column public.dashboard_periods.publicado is
  'O cliente vê este mês. Nasce false quando a linha vem do sincronizador; salvar o fechamento liga.';

create index if not exists dashboard_periods_publicados_idx
  on public.dashboard_periods (org_id, period_date desc)
  where publicado;

-- ---------------------------------------------------------------------------
-- Módulo configurado: só conta mês publicado
-- ---------------------------------------------------------------------------

create or replace function public.modulos_configurados(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_org is null
      or (p_org not in (select public.current_org_ids()) and not public.is_agency())
      then jsonb_build_object('dashboard', false, 'bio', false, 'fila', false)
    else jsonb_build_object(
      'dashboard', exists (
        select 1 from public.dashboard_periods dp
         where dp.org_id = p_org and dp.publicado
      ),
      'bio', exists (
        select 1 from public.link_pages lp where lp.org_id = p_org and lp.active
      ),
      'fila', exists (
        select 1 from public.restaurants r where r.id = p_org
      )
    )
  end;
$$;

revoke execute on function public.modulos_configurados(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Painel da agência: "último mês" é o último fechado, não o último rascunho
-- ---------------------------------------------------------------------------

create or replace function public.agencia_empresas()
returns table (
  id uuid,
  name text,
  slug text,
  dashboard boolean,
  bio boolean,
  fila boolean,
  acessos bigint,
  meses bigint,
  ultimo_mes date,
  ultimo_faturamento numeric,
  produtos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.slug,
    exists (
      select 1 from public.dashboard_periods dp
       where dp.org_id = o.id and dp.publicado
    ),
    exists (
      select 1 from public.link_pages lp where lp.org_id = o.id and lp.active
    ),
    exists (select 1 from public.restaurants r where r.id = o.id),
    (select count(*) from public.memberships m where m.org_id = o.id),
    -- Rascunho não é mês fechado: contá-lo apagaria o aviso de "fechamento
    -- atrasado" justamente no mês que está esperando ser fechado.
    (select count(*) from public.dashboard_periods dp
      where dp.org_id = o.id and dp.publicado),
    (select dp.period_date from public.dashboard_periods dp
      where dp.org_id = o.id and dp.publicado
      order by dp.period_date desc limit 1),
    (select coalesce(dp.fat_mesa, 0) + coalesce(dp.fat_delivery, 0)
          + coalesce(dp.fat_ifood, 0)
       from public.dashboard_periods dp
      where dp.org_id = o.id and dp.publicado
      order by dp.period_date desc limit 1),
    (select count(*) from public.pricing_products pp where pp.org_id = o.id)
  from public.orgs o
  where public.is_agency()
  order by o.name;
$$;

revoke execute on function public.agencia_empresas() from anon;
