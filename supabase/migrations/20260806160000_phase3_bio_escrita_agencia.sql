-- Fase 3 (ajuste): quem monta a bio é a agência, não o cliente.
--
-- Na primeira versão o cliente escrevia a própria página, seguindo o texto do
-- plano ("editor de botões no painel"). Na prática o modelo de operação da MMT é
-- outro: a agência configura tudo — slug, botões, Pixel, token — e o cliente
-- entra para acompanhar. Deixar a escrita aberta é dar ao cliente a chance de
-- derrubar sem querer a campanha que está no ar.
--
-- Leitura continua igual: a org enxerga a própria página, os próprios botões e
-- os próprios cliques. Só o `for all` passa a exigir `is_agency()`.

-- ---------------------------------------------------------------------------
-- Escrita só para a agência
-- ---------------------------------------------------------------------------

drop policy if exists link_pages_write on public.link_pages;
create policy link_pages_write_agency on public.link_pages
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());

drop policy if exists link_buttons_write on public.link_buttons;
create policy link_buttons_write_agency on public.link_buttons
  for all to authenticated
  using (public.is_agency())
  with check (public.is_agency());
