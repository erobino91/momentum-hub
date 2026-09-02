-- Dashboard: rascunho sai do alcance do cliente pela RLS, não só pelo app
--
-- `publicado` nasceu na migration anterior e o cliente deixou de ver o mês em
-- construção porque `carregarDashboard` passou a filtrar. Só que a policy
-- continuava liberando a linha inteira para quem é da org: a garantia morava em
-- um `.eq()` de um arquivo, e a próxima consulta que alguém escrevesse a
-- perderia sem erro nenhum.
--
-- Aqui a regra vira a policy. O rascunho tem os números de mídia paga de um mês
-- que a agência ainda não conferiu — e o que separa quem vê de quem não vê,
-- neste projeto, é a RLS.
--
-- A agência continua lendo tudo pelo ramo `is_agency()`: é ela quem fecha o
-- mês, e a tela de fechamento não teria como abrir no rascunho sem lê-lo.

drop policy if exists dashboard_periods_select on public.dashboard_periods;
create policy dashboard_periods_select on public.dashboard_periods
  for select to authenticated
  using (
    (org_id in (select public.current_org_ids()) and publicado)
    or public.is_agency()
  );
