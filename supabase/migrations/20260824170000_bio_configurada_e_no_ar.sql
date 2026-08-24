-- "Bio configurada" passa a significar página **no ar**, não linha existente.
--
-- `modulos_configurados()` respondia `bio: true` assim que existisse linha em
-- `link_pages`. Só que `link_pages.active` nasce **false** (é o default da
-- Fase 3) e `criarPagina` não mexe nele: toda página nasce rascunho.
--
-- O efeito, ao vivo no dia desta migration: a BB Onça — o único cliente com
-- acesso ao portal — via o card "Bio" aceso como pronto, e
-- `bio.mmtdigital.com.br/bbonca` devolvia **404**, porque a página pública é
-- lida com `.eq("active", true)`. O cliente clicava no que a agência disse que
-- estava pronto e chegava numa página que não existe.
--
-- A regra da casa não muda, só passa a ser aplicada direito: um módulo está
-- configurado quando **o recurso existe para valer**. Para o dashboard isso já
-- era "ter mês publicado" (Fase 6); para o bio é "ter página no ar", e quem
-- publica é a chave `active` no editor. Enquanto ela estiver desligada, o
-- cliente vê "em configuração" — que é a verdade.
--
-- `agencia_empresas()` (Fase 8) carregava a mesma regra frouxa e é corrigida
-- junto: o quadradinho "B" da lista e o selo "tudo pronto" da tela da empresa
-- mentiam do mesmo jeito.

-- ---------------------------------------------------------------------------
-- Módulos configurados de uma empresa
-- ---------------------------------------------------------------------------

create or replace function public.modulos_configurados(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_org is null
      or (p_org not in (select public.current_org_ids()) and not public.is_agency())
      then jsonb_build_object('dashboard', false, 'bio', false, 'fila', false)
    else jsonb_build_object(
      'dashboard', exists (
        select 1 from public.dashboard_periods dp where dp.org_id = p_org
      ),
      'bio', exists (
        select 1 from public.link_pages lp
         where lp.org_id = p_org and lp.active
      ),
      'fila', exists (
        select 1 from public.restaurants r where r.id = p_org
      )
    )
  end;
$$;

comment on function public.modulos_configurados(uuid) is
  'Booleanos de "o recurso deste módulo já existe para esta empresa". Responde '
  'apenas sobre empresas do próprio usuário; para as demais devolve tudo falso. '
  'Dashboard = ter período publicado (Fase 6). Bio = ter página no ar, não só '
  'linha criada (Fase 8: página nasce rascunho e o link público dá 404).';

-- ---------------------------------------------------------------------------
-- Lista de empresas do painel
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
    exists (
      select 1 from public.link_pages lp where lp.org_id = o.id and lp.active
    ),
    exists (select 1 from public.restaurants r where r.id = o.id),
    (select count(*) from public.memberships m where m.org_id = o.id),
    (select count(*) from public.dashboard_periods dp where dp.org_id = o.id),
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
  'de acessos, último mês publicado e faturamento dele. Bio conta só quando a '
  'página está no ar. Só responde para papel agency.';

revoke execute on function public.agencia_empresas() from anon;
