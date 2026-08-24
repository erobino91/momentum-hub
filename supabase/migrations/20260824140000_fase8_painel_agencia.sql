-- Fase 8 — o painel da agência em duas consultas.
--
-- A tela `/agencia` montava a lista assim: uma consulta de `orgs`, uma de
-- `memberships`, um `listUsers(1000)` pela Admin API e, para cada empresa, uma
-- chamada de `modulos_configurados` — **em série**, dentro de um `for`. Com dez
-- empresas são treze idas ao banco por carregamento, e a página é
-- `force-dynamic`: acontece em toda visita.
--
-- Pior que o custo era o que a lista não sabia dizer. Quem está com o
-- fechamento do mês atrasado? Quem ainda não tem ninguém entrando no portal?
-- As respostas existiam no banco e não chegavam à tela, porque cada cartão só
-- conhecia a si mesmo.
--
-- Duas funções resolvem as duas coisas:
--
--   * `agencia_empresas()`  — uma linha por empresa, com o estado dos módulos,
--     quantos acessos existem e qual foi o último mês publicado.
--   * `agencia_acessos()`   — quem entra no portal de uma empresa, já com o
--     email. Tira do app o `listUsers(1000)`, que trazia a base inteira de
--     usuários para descobrir três endereços.
--
-- As duas são `security definer` porque leem `auth.users` e atravessam a RLS de
-- várias tabelas — por isso a primeira linha de cada uma é `is_agency()`. Sem
-- ela, seriam um jeito de qualquer sessão listar as empresas todas.

-- ---------------------------------------------------------------------------
-- Lista de empresas
-- ---------------------------------------------------------------------------

create or replace function public.agencia_empresas()
returns table (
  id uuid,
  name text,
  slug text,
  dashboard boolean,
  bio boolean,
  fila boolean,
  acessos bigint,
  meses bigint,
  ultimo_mes date,
  ultimo_faturamento numeric,
  produtos bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    o.id,
    o.name,
    o.slug,
    exists (select 1 from public.dashboard_periods dp where dp.org_id = o.id),
    exists (select 1 from public.link_pages lp where lp.org_id = o.id),
    exists (select 1 from public.restaurants r where r.id = o.id),
    (select count(*) from public.memberships m where m.org_id = o.id),
    (select count(*) from public.dashboard_periods dp where dp.org_id = o.id),
    -- Último mês publicado e o faturamento dele. O total vem recomposto das
    -- partes, e não da coluna `fat_total`: é assim que o dashboard do cliente
    -- calcula, e as duas telas não podem discordar.
    (select dp.period_date from public.dashboard_periods dp
      where dp.org_id = o.id order by dp.period_date desc limit 1),
    (select coalesce(dp.fat_mesa, 0) + coalesce(dp.fat_delivery, 0)
          + coalesce(dp.fat_ifood, 0)
       from public.dashboard_periods dp
      where dp.org_id = o.id order by dp.period_date desc limit 1),
    (select count(*) from public.pricing_products pp where pp.org_id = o.id)
  from public.orgs o
  where public.is_agency()
  order by o.name;
$$;

comment on function public.agencia_empresas() is
  'Uma linha por empresa para o painel da agência: estado dos módulos, número '
  'de acessos, último mês publicado e faturamento dele. Só responde para '
  'papel agency; para qualquer outro devolve zero linhas.';

revoke execute on function public.agencia_empresas() from anon;

-- ---------------------------------------------------------------------------
-- Quem entra no portal de uma empresa
-- ---------------------------------------------------------------------------

create or replace function public.agencia_acessos(p_org uuid)
returns table (
  user_id uuid,
  email text,
  role text,
  desde timestamptz,
  ultimo_acesso timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    u.email::text,
    m.role::text,
    m.created_at,
    u.last_sign_in_at
  from public.memberships m
  join auth.users u on u.id = m.user_id
  where public.is_agency() and m.org_id = p_org
  order by m.created_at;
$$;

comment on function public.agencia_acessos(uuid) is
  'Quem entra no portal de uma empresa, com email e último acesso. Substitui o '
  'listUsers(1000) da Admin API no app. Só responde para papel agency.';

revoke execute on function public.agencia_acessos(uuid) from anon;
