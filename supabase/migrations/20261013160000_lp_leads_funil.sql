-- Funil dos leads da LP da agência e os eventos que ele manda para a Meta.
--
-- Até aqui `lp_leads` só guardava o que o form mandava, e a agência via os
-- leads no painel do Supabase. A tela `/agencia/leads` precisa de duas coisas a
-- mais: a situação de cada lead e o registro do que já foi avisado à Meta.
--
-- **Cada evento sai no máximo uma vez por lead.** É o `unique (lead_id, evento)`
-- de `lp_lead_eventos`, não o app, que segura isso: voltar um lead para
-- "proposta" e depois "cliente" de novo não pode virar duas vendas na Meta, e a
-- Meta não tem como desfazer uma venda recebida. Linha com `enviado_em` nulo é
-- evento que não chegou — a tela mostra e oferece reenviar.

-- ---------------------------------------------------------------------------
-- lp_leads — situação, valor da venda e os identificadores do Pixel
-- ---------------------------------------------------------------------------

alter table public.lp_leads
  add column if not exists status text not null default 'novo'
    check (status in ('novo', 'conversando', 'proposta', 'sem_resposta', 'cliente', 'descartado')),
  add column if not exists status_em timestamptz,
  add column if not exists valor_mensal numeric(12, 2) check (valor_mensal > 0),
  add column if not exists fbp text check (char_length(fbp) <= 200),
  add column if not exists fbc text check (char_length(fbc) <= 500);

comment on column public.lp_leads.status is
  'novo | conversando | proposta | sem_resposta | cliente | descartado. Lead não se apaga: descarta.';
comment on column public.lp_leads.valor_mensal is
  'Mensalidade fechada, informada ao marcar "cliente". Vai para a Meta como valor do Purchase.';
comment on column public.lp_leads.fbp is
  'Cookies _fbp/_fbc do Pixel no momento do form. Casam o lead com o clique no anúncio na CAPI.';

-- ---------------------------------------------------------------------------
-- O site anônimo insere só as colunas do form
-- ---------------------------------------------------------------------------

-- Com o grant de tabela inteira, quem chamasse a API direto poderia gravar um
-- lead já como "cliente" com valor — e a tela mandaria esse valor para a Meta.
-- `id` entra na lista porque o form gera o id no navegador: ele é o `eventID`
-- do Lead no Pixel, e o hub repete o mesmo id na CAPI para a Meta deduplicar.
revoke insert on public.lp_leads from anon;
grant insert (id, nome, whatsapp, faturamento, fbp, fbc) on public.lp_leads to anon;

-- ---------------------------------------------------------------------------
-- lp_lead_eventos — o que foi (ou não) avisado à Meta
-- ---------------------------------------------------------------------------

create table if not exists public.lp_lead_eventos (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.lp_leads (id) on delete cascade,
  evento      text not null check (evento in ('Lead', 'PropostaEnviada', 'Purchase')),
  valor       numeric(12, 2),
  enviado_em  timestamptz,
  erro        text,
  created_at  timestamptz not null default now(),
  unique (lead_id, evento)
);

comment on table public.lp_lead_eventos is
  'Eventos de CAPI por lead, no máximo um de cada. enviado_em nulo = não chegou à Meta.';

alter table public.lp_lead_eventos enable row level security;

revoke all on public.lp_lead_eventos from anon;

drop policy if exists lp_lead_eventos_agencia on public.lp_lead_eventos;
create policy lp_lead_eventos_agencia on public.lp_lead_eventos
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());
