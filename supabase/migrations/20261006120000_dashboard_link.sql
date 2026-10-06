-- Dashboard: link fixo por empresa, sem login
--
-- Clientes reclamaram do login, e o "esqueci a senha" não chega: o projeto usa
-- o SMTP embutido da Supabase, que só entrega para a equipe do projeto. O
-- dashboard passa a abrir também por `/d/<token>` — só leitura, só os meses
-- publicados, nada de CMV/fila/bio.
--
-- O token é o segredo: 32 hex aleatórios, trocável pela agência em
-- `/agencia/<empresa>`. Trocar derruba o link antigo na hora.
--
-- Sem policy nova: quem lê pelo link é a página pública com a chave secreta,
-- buscando a org por este token; `orgs_select` deixa o membro ver o da própria
-- empresa, que é o link dele mesmo.

alter table public.orgs
  add column if not exists dashboard_token text not null
    default replace(gen_random_uuid()::text, '-', '');

create unique index if not exists orgs_dashboard_token_key
  on public.orgs (dashboard_token);

comment on column public.orgs.dashboard_token is
  'Segredo do link público do dashboard (/d/<token>). Trocar invalida o link anterior.';
