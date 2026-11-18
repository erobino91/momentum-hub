-- Dashboard: a empresa de cada cliente na Repediu (CRM)
--
-- Sétima conexão, na mesma forma das outras: uma coluna em `orgs` com o
-- `company_id` (uuid) da loja na Repediu. Não há credencial: os números vêm do
-- conector do claude.ai, coletados pelo `/relatorio` e passados em `--dados`.
--
-- Preenche `crm_vendas` e `crm_invest`.
--
-- Sem policy nova: `orgs_select` e `orgs_write_agency` já cobrem a tabela.

alter table public.orgs
  add column if not exists repediu_company_id text;

comment on column public.orgs.repediu_company_id is
  'company_id (uuid) da loja na Repediu. Vazio = bloco CRM digitado.';
