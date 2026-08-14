-- Fase 6.4 — "dashboard configurado" deixa de ser o slug do projeto antigo.
--
-- `modulos_configurados()` respondia `dashboard: true` quando havia
-- `config.dashboard_slug` preenchido — o ponteiro para o cliente no projeto
-- `mynolirdauvkubxvlddt`. Com os números morando aqui, o slug não aponta para
-- lugar nenhum, e o critério passa a ser o que a regra da casa sempre disse:
-- **o recurso existe**. Para o dashboard, recurso é ter mês publicado.
--
-- Efeito prático: empresa cadastrada sem nenhum período fechado mostra o card
-- em "em configuração", em vez de abrir uma tela vazia.

-- ---------------------------------------------------------------------------
-- Função
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
        select 1 from public.link_pages lp where lp.org_id = p_org
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
  'Dashboard = ter período publicado (Fase 6; antes era o slug do projeto antigo).';
