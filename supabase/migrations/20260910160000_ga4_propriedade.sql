-- Dashboard: a propriedade do Google Analytics de cada empresa
--
-- Quarta conexão da agência, na mesma forma das três primeiras: uma coluna em
-- `orgs` guardando **o identificador** do outro lado. Aqui é o id numérico da
-- propriedade GA4 (Administrador → Detalhes da propriedade), aquele que aparece
-- também na URL do relatório como `p123456789`.
--
-- A credencial é uma conta de serviço do Google, uma só para a carteira inteira,
-- e fica em `Momentum Digital/.env` (`GA4_CREDENCIAL`) — fora do hub, como as
-- outras. Aqui só o número.
--
-- É a conexão que preenche o **funil do cardápio próprio** (`cp_*`): o dado que
-- a agência lia a olho no painel do CardápioWeb e digitava. Nem a API do CW nem
-- a da Goomer expõem esse funil (conferido em 10/09/2026), então GA4 é a única
-- fonte possível — e o número vem de um sistema de medição diferente do painel,
-- o que muda o degrau da série no primeiro mês sincronizado.
--
-- Vazio = funil digitado, ou cliente sem cardápio próprio (a seção `funil_cp`
-- desligada nos blocos que ele vê).
--
-- Sem policy nova: `orgs_select` e `orgs_write_agency` (Fase 1) já cobrem a
-- tabela inteira, e quem escreve em `orgs` é só a agência.

alter table public.orgs
  add column if not exists ga4_property_id text;

comment on column public.orgs.ga4_property_id is
  'ID numérico da propriedade GA4 do cardápio. Vazio = funil do cardápio digitado.';
