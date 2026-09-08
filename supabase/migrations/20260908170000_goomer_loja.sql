-- Dashboard: a loja de cada empresa na Goomer
--
-- Terceira conexão da agência, na mesma forma das duas primeiras: uma coluna em
-- `orgs` guardando **o identificador** da loja do outro lado. O token da loja
-- continua em `Momentum Digital/clientes/<slug>/goomer.env`, fora do hub — o
-- coletor acha a pasta pelo id que está aqui.
--
-- Guarda o `GOOMER_STORE_ID` como a Goomer o escreve, com o `G-` na frente
-- (`G-57981`): é assim que ele aparece no painel e no `.env`, e tirar o prefixo
-- só criaria duas grafias do mesmo número.
--
-- A Goomer preenche **delivery**, nunca salão: o INDOOR dela é o pedido feito
-- na mesa pelo QR, não o movimento do salão. Empresa que tem CardápioWeb e
-- Goomer ao mesmo tempo é recusada pelo sincronizador até sobrar um dono para o
-- delivery — a BB Onça é esse caso, e o dono é a Goomer.
--
-- Sem policy nova: `orgs_select` e `orgs_write_agency` (Fase 1) já cobrem a
-- tabela inteira, e quem escreve em `orgs` é só a agência.

alter table public.orgs
  add column if not exists goomer_store_id text;

comment on column public.orgs.goomer_store_id is
  'ID da loja na Goomer (G-00000). Vazio = delivery digitado ou vindo de outro cardápio.';
