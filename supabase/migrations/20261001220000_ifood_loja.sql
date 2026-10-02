-- Dashboard: a loja de cada empresa no iFood
--
-- Quinta conexão da agência, na mesma forma das outras: uma coluna em `orgs`
-- guardando **o identificador** da loja do outro lado — o uuid do iFood
-- (`b042983e-fd37-4b1a-887d-66f4d703cadd`), não o número curto que o Portal
-- mostra ao lado do nome (`1658952`), porque é o uuid que as rotas do Portal
-- pedem.
--
-- Não há credencial por cliente: o coletor usa a sessão do login da agência no
-- Portal do Parceiro, que enxerga todas as lojas, e ela fica em
-- `Momentum Digital/conexao-ifood-portal/`, fora do hub.
--
-- Preenche `fat_ifood` e o funil `if_*`. O CardápioWeb conhece o pedido do
-- iFood mas não escreve `fat_ifood` (sai ~5% abaixo do Portal), então não há
-- colisão de colunas entre as duas conexões.
--
-- Sem policy nova: `orgs_select` e `orgs_write_agency` (Fase 1) já cobrem a
-- tabela inteira, e quem escreve em `orgs` é só a agência.

alter table public.orgs
  add column if not exists ifood_merchant_id text;

comment on column public.orgs.ifood_merchant_id is
  'uuid da loja no iFood. Vazio = faturamento e funil do iFood digitados.';
