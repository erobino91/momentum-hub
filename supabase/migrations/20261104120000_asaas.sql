-- ASAAS — a cobrança do hub vira um PIX/boleto de verdade.
--
-- O modelo da Fase 9 já cabia: cobrança é uma linha com id, valor, vencimento e
-- status. Isto só acrescenta o vínculo com o ASAAS e os dados que ele exige do
-- cliente. `status` continua sendo a verdade do hub; o ASAAS só escreve nele
-- pelo webhook (pendente → pago), nunca o contrário.
--
--   * contrato: CPF/CNPJ (o ASAAS não cria cliente sem), e-mail e WhatsApp para
--     as notificações que o próprio ASAAS manda, e o id do cliente lá.
--   * cobrança: id do pagamento lá e o link da fatura, que é o que se manda ao
--     cliente.

-- ---------------------------------------------------------------------------
-- Contrato
-- ---------------------------------------------------------------------------

alter table public.billing_contracts
  -- Só dígitos: 11 é CPF, 14 é CNPJ. O dígito verificador quem confere é o
  -- ASAAS, que recusa o cadastro com mensagem própria.
  add column if not exists cpf_cnpj text
    check (cpf_cnpj ~ '^([0-9]{11}|[0-9]{14})$'),
  add column if not exists email text,
  add column if not exists telefone text,
  add column if not exists asaas_customer_id text;

-- ---------------------------------------------------------------------------
-- Cobrança
-- ---------------------------------------------------------------------------

alter table public.billing_charges
  add column if not exists asaas_payment_id text unique,
  add column if not exists asaas_url text;

-- ---------------------------------------------------------------------------
-- A tela do financeiro passa a saber do ASAAS
-- ---------------------------------------------------------------------------

-- Mudar o tipo de retorno exige `drop`: `create or replace` recusa.
drop function if exists public.agencia_financeiro(date);

create function public.agencia_financeiro(p_mes date)
returns table (
  org_id           uuid,
  name             text,
  slug             text,
  contrato_id      uuid,
  situacao         text,
  dia_vencimento   smallint,
  forma_pagamento  text,
  cliente_desde    date,
  observacao       text,
  cpf_cnpj         text,
  valor_vigente    numeric,
  cobranca_id      uuid,
  competencia      date,
  vencimento       date,
  valor            numeric,
  status           text,
  pago_em          date,
  cobranca_obs     text,
  asaas_payment_id text,
  asaas_url        text
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
    c.cpf_cnpj,
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
    ch.observacao,
    ch.asaas_payment_id,
    ch.asaas_url
  from public.orgs o
  left join public.billing_contracts c on c.org_id = o.id
  left join public.billing_charges ch
         on ch.org_id = o.id
        and ch.competencia = date_trunc('month', p_mes)::date
  -- `interna`: a casa da agência não entra (20261005120000).
  where public.is_agency() and not public.interna(o)
  order by o.name;
$$;

comment on function public.agencia_financeiro(date) is
  'Uma linha por empresa para a tela do financeiro: contrato, valor vigente no '
  'mês consultado e a cobrança daquele mês (com o vínculo do ASAAS), se existir. '
  'Só responde para papel agency.';

revoke execute on function public.agencia_financeiro(date) from anon;
