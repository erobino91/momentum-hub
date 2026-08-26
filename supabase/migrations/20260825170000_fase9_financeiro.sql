-- Fase 9 — o financeiro da agência.
--
-- O painel sabia dizer se o cliente tem dashboard publicado, bio no ar e quem
-- entra no portal. Não sabia dizer quanto ele paga, quando vence e se pagou —
-- a única informação sobre o cliente que a agência consulta todo mês e não
-- tinha onde olhar.
--
-- Três tabelas e as decisões que as sustentam:
--
--   * `billing_contracts` — um contrato por empresa: situação, dia de
--     vencimento, forma de pagamento, cliente desde. **Sem coluna de valor.**
--   * `billing_values`    — o valor mora aqui, com a data em que passou a
--     valer. Reajuste é linha nova, nunca `update`. Não existe `valor_atual`
--     em lugar nenhum para discordar do histórico.
--   * `billing_charges`   — uma linha por mês por empresa, com o valor
--     **congelado na geração**.
--
-- Por que a cobrança é materializada em vez de derivada do contrato: contrato
-- muda. Cliente que pausa em setembro precisa continuar mostrando a cobrança de
-- agosto, e cliente reajustado em julho precisa que junho continue valendo o
-- preço antigo. Derivar o passado do contrato de hoje faz o passado se
-- reescrever sozinho.
--
-- E por que não existe status "atrasado": atrasado é `pendente` com
-- `vencimento < hoje`, calculado na leitura. Gravado, ele envelhece calado —
-- ninguém roda o job que viraria pendente em atrasado, e a tela passa a mentir.
-- É a mesma regra de "dashboard configurado é ter mês publicado", não uma
-- coluna marcada na mão.
--
-- Como `pricing_*` e `live_*`, isto é da agência: a policy é `is_agency()` sem
-- ramo de org. Nenhuma tela de cliente lê estas tabelas.

-- ---------------------------------------------------------------------------
-- Contrato
-- ---------------------------------------------------------------------------

create table if not exists public.billing_contracts (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null unique references public.orgs (id) on delete cascade,
  situacao        text not null default 'ativo'
                    check (situacao in ('ativo', 'pausado', 'encerrado')),
  -- 1 a 31. O dia real da cobrança sai de `vencimento_do_mes()`, que corta no
  -- último dia do mês: dia 31 não existe em fevereiro.
  dia_vencimento  smallint not null check (dia_vencimento between 1 and 31),
  forma_pagamento text
                    check (forma_pagamento in ('pix', 'boleto', 'cartao', 'transferencia', 'outro')),
  cliente_desde   date,
  observacao      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists billing_contracts_touch_updated_at on public.billing_contracts;
create trigger billing_contracts_touch_updated_at
  before update on public.billing_contracts
  for each row execute function public.touch_updated_at();

comment on table public.billing_contracts is
  'Contrato de mensalidade de uma empresa. Não guarda valor: o valor mora em '
  'billing_values com a data de vigência, para reajuste não reescrever o passado.';

-- ---------------------------------------------------------------------------
-- Histórico de valor
-- ---------------------------------------------------------------------------

create table if not exists public.billing_values (
  id            uuid primary key default gen_random_uuid(),
  contract_id   uuid not null references public.billing_contracts (id) on delete cascade,
  valor         numeric(10, 2) not null check (valor >= 0),
  vigente_desde date not null,
  created_at    timestamptz not null default now(),
  unique (contract_id, vigente_desde)
);

create index if not exists billing_values_contrato_idx
  on public.billing_values (contract_id, vigente_desde desc);

comment on table public.billing_values is
  'Quanto a empresa paga, e desde quando. Reajuste insere linha nova; o valor '
  'vigente é a linha mais recente com vigente_desde <= a data consultada.';

-- ---------------------------------------------------------------------------
-- Cobranças
-- ---------------------------------------------------------------------------

create table if not exists public.billing_charges (
  id          uuid primary key default gen_random_uuid(),
  -- Aponta para a empresa, não para o contrato: cobrança é história, e história
  -- não some quando o contrato é refeito.
  org_id      uuid not null references public.orgs (id) on delete cascade,
  competencia date not null,          -- primeiro dia do mês, como dashboard_periods
  vencimento  date not null,
  valor       numeric(10, 2) not null check (valor >= 0),
  status      text not null default 'pendente'
                check (status in ('pendente', 'pago', 'cancelado')),
  pago_em     date,
  observacao  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, competencia),
  -- Pago sem data de pagamento é meio-pago: não dá para conferir extrato nem
  -- dizer se entrou no mês certo.
  constraint billing_charges_pago_tem_data
    check (status <> 'pago' or pago_em is not null)
);

create index if not exists billing_charges_competencia_idx
  on public.billing_charges (competencia, status);

drop trigger if exists billing_charges_touch_updated_at on public.billing_charges;
create trigger billing_charges_touch_updated_at
  before update on public.billing_charges
  for each row execute function public.touch_updated_at();

comment on table public.billing_charges is
  'Uma cobrança por mês por empresa, com o valor congelado na geração. Não há '
  'status "atrasado": atrasado é pendente com vencimento < hoje, calculado na '
  'leitura.';

-- ---------------------------------------------------------------------------
-- RLS — só agência, leitura e escrita
-- ---------------------------------------------------------------------------

alter table public.billing_contracts enable row level security;
alter table public.billing_values    enable row level security;
alter table public.billing_charges   enable row level security;

drop policy if exists billing_contracts_agencia on public.billing_contracts;
create policy billing_contracts_agencia on public.billing_contracts
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

drop policy if exists billing_values_agencia on public.billing_values;
create policy billing_values_agencia on public.billing_values
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

drop policy if exists billing_charges_agencia on public.billing_charges;
create policy billing_charges_agencia on public.billing_charges
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

-- ---------------------------------------------------------------------------
-- O dia do vencimento num mês concreto
-- ---------------------------------------------------------------------------

-- Dia 31 em fevereiro vira 28 (ou 29). Fica no banco para a geração e a tela
-- nunca discordarem sobre a data.
create or replace function public.vencimento_do_mes(p_dia int, p_competencia date)
returns date
language sql
immutable
as $$
  select (date_trunc('month', p_competencia)::date
          + (least(
               p_dia,
               extract(day from (date_trunc('month', p_competencia)
                                 + interval '1 month - 1 day'))::int
             ) - 1));
$$;

comment on function public.vencimento_do_mes(int, date) is
  'Data real do vencimento no mês da competência, cortada no último dia do mês.';

-- ---------------------------------------------------------------------------
-- Valor vigente numa data
-- ---------------------------------------------------------------------------

create or replace function public.mensalidade_vigente(
  p_contract uuid,
  p_data date default current_date
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select bv.valor
    from public.billing_values bv
   where bv.contract_id = p_contract
     and bv.vigente_desde <= p_data
   order by bv.vigente_desde desc
   limit 1;
$$;

revoke execute on function public.mensalidade_vigente(uuid, date) from anon;

-- ---------------------------------------------------------------------------
-- A tela do financeiro numa consulta
-- ---------------------------------------------------------------------------

-- `left join` de propósito: empresa sem contrato aparece na lista com tudo
-- nulo. O painel serve para achar o que falta, e o que some da tela não é feito
-- — mesmo instinto do filtro "Sem acesso" que já existe em /agencia.
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
  where public.is_agency()
  order by o.name;
$$;

comment on function public.agencia_financeiro(date) is
  'Uma linha por empresa para a tela do financeiro: contrato, valor vigente no '
  'mês consultado e a cobrança daquele mês, se existir. Empresa sem contrato '
  'entra com nulos. Só responde para papel agency.';

revoke execute on function public.agencia_financeiro(date) from anon;

-- ---------------------------------------------------------------------------
-- Gerar as cobranças de um mês
-- ---------------------------------------------------------------------------

-- Idempotente por construção: `do nothing` no conflito. Rodar duas vezes não
-- duplica nem sobrescreve — o mês já gerado fica como está, inclusive o que já
-- foi pago ou cancelado à mão.
--
-- Isto é o que dispensa cron: a geração é um clique na tela que a agência abre
-- de qualquer jeito uma vez por mês.
create or replace function public.gerar_cobrancas(p_mes date)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_mes date := date_trunc('month', p_mes)::date;
  v_criadas integer;
begin
  if not public.is_agency() then
    raise exception 'apenas a agência gera cobranças';
  end if;

  insert into public.billing_charges (org_id, competencia, vencimento, valor)
  select
    c.org_id,
    v_mes,
    public.vencimento_do_mes(c.dia_vencimento, v_mes),
    public.mensalidade_vigente(
      c.id,
      public.vencimento_do_mes(c.dia_vencimento, v_mes)
    )
  from public.billing_contracts c
  where c.situacao = 'ativo'
    -- Contrato que começa depois do fim do mês não deve nada nesse mês.
    and (c.cliente_desde is null
         or c.cliente_desde <= (v_mes + interval '1 month - 1 day')::date)
    -- Sem valor vigente não há o que cobrar: o contrato existe, o preço ainda
    -- não foi registrado. Gerar R$ 0 aqui seria inventar um número.
    and public.mensalidade_vigente(
          c.id,
          public.vencimento_do_mes(c.dia_vencimento, v_mes)
        ) is not null
  on conflict (org_id, competencia) do nothing;

  get diagnostics v_criadas = row_count;
  return v_criadas;
end;
$$;

comment on function public.gerar_cobrancas(date) is
  'Cria a cobrança do mês para cada contrato ativo com valor vigente. '
  'Idempotente: o mês já gerado não é tocado. Devolve quantas nasceram.';

revoke execute on function public.gerar_cobrancas(date) from anon;
