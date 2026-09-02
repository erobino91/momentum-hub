-- Dashboard: a conta de anúncio do Meta de cada empresa
--
-- Até aqui `meta_invest` e `meta_vendas` eram dois números digitados no
-- fechamento do mês, como os outros vinte e dois. Esta coluna é o que liga a
-- empresa do portal à conta de anúncio do outro lado, para o número vir da
-- própria Graph API em vez de ser transcrito à mão.
--
-- Guarda o id **sem** o prefixo `act_` — é assim que ele viaja no
-- `accounts.json` da integração, e quem monta `act_{id}` é sempre quem chama a
-- API. Guardar as duas formas seria escolher qual delas está certa toda vez que
-- alguém lê a coluna.
--
-- Vazio é um estado legítimo e é o padrão: empresa sem Meta, ou com Meta ainda
-- não vinculado, continua digitando os dois campos na mão.
--
-- Sem policy nova: `orgs_select` e `orgs_write_agency` (Fase 1) já cobrem a
-- tabela inteira, e quem escreve em `orgs` é só a agência.

alter table public.orgs
  add column if not exists meta_ad_account_id text;

comment on column public.orgs.meta_ad_account_id is
  'Conta de anúncio do Meta, sem o prefixo act_. Vazio = sem Meta sincronizado.';
