-- Fim do conceito de "módulo vendido".
--
-- A Fase 1 nasceu com `entitlements.enabled`: um interruptor por empresa e por
-- módulo, mais botões liga/desliga na área da agência. Isso embutiu no produto
-- uma decisão comercial que nunca existiu — **o serviço não é fragmentado, todo
-- cliente tem acesso a todos os recursos**.
--
-- O que a coluna misturava, e que agora se separa:
--
--   * "este cliente comprou o módulo"     → não existe. É o que sai daqui.
--   * "este cliente está configurado nele" → existe e continua, mas é DERIVADO
--     do recurso existir (slug do dashboard preenchido, restaurante criado,
--     página de bio criada). Deixa de ser um estado que alguém marca na mão e
--     que pode divergir da realidade — foi exatamente o que aconteceu: `fila`
--     ficou ligada para duas empresas sem restaurante nenhum.
--
-- A tabela sobrevive à mudança porque guarda configuração de verdade: o
-- `config.dashboard_slug`, que é segredo (com ele qualquer um abre o dashboard
-- antigo sem login). O que morre é o nome e a coluna.

-- ---------------------------------------------------------------------------
-- Renomeia a tabela e o que carrega o nome antigo
-- ---------------------------------------------------------------------------

alter table public.entitlements rename to module_config;

alter index if exists entitlements_pkey rename to module_config_pkey;
alter index if exists entitlements_org_id_idx rename to module_config_org_id_idx;
alter index if exists entitlements_org_id_module_key rename to module_config_org_id_module_key;

alter policy entitlements_select on public.module_config
  rename to module_config_select;
alter policy entitlements_write_agency on public.module_config
  rename to module_config_write_agency;

alter trigger entitlements_touch_updated_at on public.module_config
  rename to module_config_touch_updated_at;

comment on table public.module_config is
  'Configuração por empresa e por módulo. NÃO é liberação de acesso: todo '
  'cliente tem todos os módulos. Se um módulo aparece pronto para o cliente é '
  'consequência de o recurso dele existir — ver modulos_configurados().';

-- ---------------------------------------------------------------------------
-- Derruba o interruptor
-- ---------------------------------------------------------------------------

-- Sem escape hatch de propósito. Um "desligar só para este cliente" reintroduz
-- exatamente o conceito que está sendo removido, e reintroduz junto a chance de
-- o estado marcado na mão discordar da realidade.
alter table public.module_config drop column enabled;

-- ---------------------------------------------------------------------------
-- Quais módulos deste cliente estão configurados
-- ---------------------------------------------------------------------------

-- `security definer` por necessidade, não por conveniência: a RLS de
-- `restaurants` filtra por `current_restaurant_id()`, que lê `profiles`. O dono
-- da empresa no portal **não tem** `profiles` — é decisão da Fase 4, porque
-- membership é org-wide e daria ao balcão o dashboard de faturamento do dono.
-- Resultado: a sessão dele lê zero linhas de `restaurants` e não consegue
-- descobrir se a própria empresa tem fila preparada.
--
-- A função atravessa isso sem abrir dado nenhum: devolve três booleanos, e só
-- para empresa da qual o chamador é membro — ou para qualquer uma, se ele for
-- da agência, que é quem configura e precisa ver o estado de todas em
-- `/agencia`. Para as demais a resposta é tudo falso, inclusive quando a
-- empresa existe e está configurada: é isso que a impede de virar um oráculo
-- sobre a base de clientes.
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
        select 1 from public.restaurants r where r.id = p_org
      )
    )
  end;
$$;

comment on function public.modulos_configurados(uuid) is
  'Booleanos de "o recurso deste módulo já existe para esta empresa". Responde '
  'apenas sobre empresas do próprio usuário; para as demais devolve tudo falso.';

revoke execute on function public.modulos_configurados(uuid) from anon;
grant execute on function public.modulos_configurados(uuid) to authenticated;
