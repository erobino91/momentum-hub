-- Quem cria a conta do cliente é a agência, não o cliente.
--
-- A Fase 1 fez ao contrário: a agência registrava um convite e o acesso só
-- existia quando o cliente ia até `/cadastro` e criava a conta sozinho — um
-- trigger em `auth.users` convertia o convite em membership. A justificativa era
-- não precisar da chave secreta no app.
--
-- Não sobreviveu ao uso: o passo final ficava com quem menos tem motivo para
-- dar o passo. A Villa Burguer passou oito dias com convite pendente e zero
-- membro, e na hora de tirar o dashboard antigo do ar eram oito clientes
-- dependendo de irem se cadastrar.
--
-- Agora a conta nasce pronta pela Admin API (`criarAcessoCliente` na área da
-- agência) e a agência entrega email e senha. A chave secreta já morava no app
-- desde a Fase 3 — a página pública do bio não tem sessão e precisa dela.
--
-- Com isso o convite deixa de existir. Manter os dois caminhos para a mesma
-- coisa é garantir que um dia eles discordem.

-- ---------------------------------------------------------------------------
-- Fim do convite
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created_accept_invites on auth.users;
drop function if exists public.accept_invites_for_new_user();
drop table if exists public.invites;
