-- A agência não é cliente
--
-- O login da equipe precisa morar numa empresa — a `momentum-digital` —, e por
-- isso ela aparecia como cliente: na lista de empresas e no contador do menu,
-- no financeiro (como "sem contrato") e com um card nas lives.
--
-- Quem diz que a empresa é a casa da agência é o próprio banco: ela tem alguém
-- com papel `agency`. Derivado, não marcado à mão — mesma regra do "módulo
-- configurado". Uma coluna ligada na mão dependeria de alguém lembrar, e o
-- esquecimento só apareceria como cliente fantasma na lista.
--
-- `interna(orgs)` recebe a linha da tabela, e é isso que faz o PostgREST
-- tratá-la como coluna: `orgs?interna=eq.false` filtra sem RPC nova. É o que o
-- contador do menu e a tela de lives usam; as duas RPCs abaixo chamam direto.

-- ---------------------------------------------------------------------------
-- A casa da agência
-- ---------------------------------------------------------------------------

create or replace function public.interna(public.orgs)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
     where m.org_id = $1.id and m.role = 'agency'
  );
$$;

comment on function public.interna(public.orgs) is
  'A empresa é a casa da agência (tem membro com papel agency), não um cliente. '
  'Coluna computada no PostgREST: orgs?interna=eq.false.';

revoke execute on function public.interna(public.orgs) from anon;

-- ---------------------------------------------------------------------------
-- Lista de empresas sem a agência
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
  where public.is_agency() and not public.interna(o)
  order by o.name;
$$;

revoke execute on function public.agencia_empresas() from anon;

-- ---------------------------------------------------------------------------
-- Financeiro sem a agência
-- ---------------------------------------------------------------------------

-- Sem este filtro a casa da agência entrava como "sem contrato" — linha que
-- pede uma providência que nunca vai existir.
create or replace function public.agencia_financeiro(p_mes date)
returns table (
  org_id          uuid,
  name            text,
  slug            text,
  contrato_id     uuid,
  situacao        text,
  dia_vencimento  smallint,
  forma_pagamento text,
  cliente_desde   date,
  observacao      text,
  valor_vigente   numeric,
  cobranca_id     uuid,
  competencia     date,
  vencimento      date,
  valor           numeric,
  status          text,
  pago_em         date,
  cobranca_obs    text
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
    c.id,
    c.situacao,
    c.dia_vencimento,
    c.forma_pagamento,
    c.cliente_desde,
    c.observacao,
    -- Vigente no vencimento do mês consultado, não hoje: em agosto, olhar
    -- junho tem de mostrar o preço de junho.
    public.mensalidade_vigente(
      c.id,
      public.vencimento_do_mes(c.dia_vencimento, date_trunc('month', p_mes)::date)
    ),
    ch.id,
    ch.competencia,
    ch.vencimento,
    ch.valor,
    ch.status,
    ch.pago_em,
    ch.observacao
  from public.orgs o
  left join public.billing_contracts c on c.org_id = o.id
  left join public.billing_charges ch
         on ch.org_id = o.id
        and ch.competencia = date_trunc('month', p_mes)::date
  where public.is_agency() and not public.interna(o)
  order by o.name;
$$;

revoke execute on function public.agencia_financeiro(date) from anon;
