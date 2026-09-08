-- Dashboard: a loja de cada empresa no CardápioWeb
--
-- Segunda conexão da agência, na mesma forma da primeira (`meta_ad_account_id`):
-- uma coluna em `orgs` guardando **o identificador** da loja do outro lado. A
-- credencial não entra aqui — o número do mês vem pelo conector do CardápioWeb,
-- autenticado como a pessoa, e esta coluna só diz de qual loja.
--
-- Guarda o **uuid** que `list_merchants` devolve, não o `id` numérico: é o que
-- todas as chamadas do conector pedem como `merchant_uuid`, e guardar o número
-- obrigaria a traduzir um no outro toda vez.
--
-- Vazio é o padrão e é legítimo: empresa sem CardápioWeb (ou que usa outro
-- cardápio digital) continua com salão e delivery digitados no fechamento. O
-- campo preenchido é o que diz "esta empresa é CardápioWeb" — não existe um
-- segundo campo "cardápio digital" para discordar dele.
--
-- Sem policy nova: `orgs_select` e `orgs_write_agency` (Fase 1) já cobrem a
-- tabela inteira, e quem escreve em `orgs` é só a agência.

alter table public.orgs
  add column if not exists cw_store_id text;

comment on column public.orgs.cw_store_id is
  'UUID da loja no CardápioWeb (merchant_uuid). Vazio = salão e delivery digitados.';
