-- Leads do formulário da landing page da agência (lp-agencia/form.html).
--
-- Até aqui o form não gravava nada: ao enviar, abria o WhatsApp da pessoa com a
-- mensagem pronta e o lead só existia se ela apertasse "enviar" lá. Com a página
-- de obrigado no meio, quem não clica no botão de WhatsApp sumiria sem deixar
-- contato — então o form grava aqui antes de redirecionar.
--
-- A página é estática e anônima: entra com a anon key, que é pública. Por isso o
-- papel `anon` só **insere** (nunca lê, altera ou apaga) e os `check` seguram o
-- tamanho do que entra. Ler é só da agência.

create table if not exists public.lp_leads (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (char_length(nome) between 2 and 120),
  whatsapp    text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  faturamento text not null check (char_length(faturamento) <= 60),
  created_at  timestamptz not null default now()
);

comment on table public.lp_leads is
  'Leads do formulário da LP da agência. Anon só insere; só a agência lê.';
comment on column public.lp_leads.whatsapp is
  'Só dígitos, com DDD e sem o +55 (o form manda o que a pessoa digitou, limpo).';

create index if not exists lp_leads_created_at_idx on public.lp_leads (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — anon insere, agência lê
-- ---------------------------------------------------------------------------

alter table public.lp_leads enable row level security;

revoke all on public.lp_leads from anon;
grant insert on public.lp_leads to anon;

drop policy if exists lp_leads_insere_anon on public.lp_leads;
create policy lp_leads_insere_anon on public.lp_leads
  for insert to anon
  with check (true);

drop policy if exists lp_leads_agencia on public.lp_leads;
create policy lp_leads_agencia on public.lp_leads
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());
