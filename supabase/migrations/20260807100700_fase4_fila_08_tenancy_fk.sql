-- Fase 4 — Fila de Espera, migration 8 de 8. Esta é a única que não existe no
-- repo do Fila: é a costura entre os dois mundos.
--
-- **Invariante: `restaurants.id` é sempre o `orgs.id` do mesmo cliente.**
-- `restaurants` deixa de ser uma tabela de tenancy independente e vira uma
-- extensão 1:1 de `orgs` — BB Onça é uma empresa só nos dois módulos.
--
-- Por que `restaurants` continua existindo, em vez de repontar tudo para `orgs`:
-- as policies do Fila filtram por `current_restaurant_id()`, que lê `profiles`.
-- Trocar para membership faria o balcão precisar de `membership` na org — e
-- membership é org-wide, então quem atende no caixa passaria a ver o dashboard
-- de faturamento do dono. Com a FK, nenhum arquivo do app do Fila muda.
--
-- `restrict`, não `cascade`: apagar uma org em `/agencia` tem que falhar alto,
-- não evaporar em silêncio a PII de milhares de clientes do restaurante.

-- ---------------------------------------------------------------------------
-- FK de tenancy
-- ---------------------------------------------------------------------------

alter table public.restaurants
  add constraint restaurants_id_fkey
  foreign key (id) references public.orgs (id) on delete restrict;

comment on constraint restaurants_id_fkey on public.restaurants is
  'restaurants.id = orgs.id do mesmo cliente (Fase 4). Nunca gerar id novo aqui.';

comment on table public.restaurants is
  'Extensão 1:1 de orgs para o módulo Fila de Espera. O id vem de orgs, não de '
  'gen_random_uuid(). Quem enxerga estas tabelas é quem tem profiles, não quem '
  'tem membership: membership decide SE o usuário chega ao módulo, profiles '
  'decide O QUE ele faz dentro.';
