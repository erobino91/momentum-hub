-- Dashboard: a conta de cada empresa no Google Ads
--
-- Sexta conexão da agência, na mesma forma das outras: uma coluna em `orgs`
-- guardando **o identificador** do outro lado — o id da conta do Google Ads, só
-- os dez dígitos (a tela mostra `660-215-7897`; a API quer `6602157897`).
--
-- Não há credencial por cliente: o coletor usa o OAuth da agência lendo pela
-- MCC, e ele fica em `Momentum Digital/.env` (`GOOGLE_ADS_*`), fora do hub. A
-- conta só é lida se estiver vinculada à MCC.
--
-- Preenche `google_invest`, `google_vendas`, `google_visitas_loja` e
-- `google_rotas`.
--
-- Sem policy nova: `orgs_select` e `orgs_write_agency` (Fase 1) já cobrem a
-- tabela inteira, e quem escreve em `orgs` é só a agência.

alter table public.orgs
  add column if not exists google_ads_customer_id text;

comment on column public.orgs.google_ads_customer_id is
  'Id da conta do Google Ads (10 dígitos, sem traço). Vazio = bloco Google digitado.';
