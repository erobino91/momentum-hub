-- Correção da migration anterior: `fila` é por usuário, não por empresa.
--
-- A primeira versão marcava a fila como configurada quando a empresa tinha
-- restaurante. Mas quem clica no card é uma pessoa, e o acesso ao Fila vem de
-- `profiles`, não de `membership` (Fase 4: membership é org-wide e daria ao
-- balcão o dashboard de faturamento do dono). Uma empresa pode ter restaurante
-- com o dono ainda sem `profiles` — é exatamente o caso do BB Onça hoje — e aí
-- o card acenderia para levar a "esta conta não atende nenhum restaurante",
-- que é justamente o beco que esta mudança existe para fechar.
--
-- Para a agência a pergunta continua sendo da empresa: ela não usa a fila de
-- ninguém, só precisa saber se já está preparada.

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
        select 1 from public.module_config mc
        where mc.org_id = p_org
          and mc.module = 'dashboard'
          and coalesce(mc.config ->> 'dashboard_slug', '') <> ''
      ),
      'bio', exists (
        select 1 from public.link_pages lp where lp.org_id = p_org
      ),
      'fila', exists (
        select 1
        from public.restaurants r
        where r.id = p_org
          and (
            public.is_agency()
            or exists (
              select 1 from public.profiles pr
              where pr.id = auth.uid() and pr.restaurant_id = r.id
            )
          )
      )
    )
  end;
$$;
