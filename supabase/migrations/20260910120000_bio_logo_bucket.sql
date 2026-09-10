-- ---------------------------------------------------------------------------
-- Bucket da logo da bio
--
-- Diferente de `materials`, este nasce **público**: a logo é renderizada na
-- página `/b/<slug>`, que não tem sessão nenhuma. URL assinada ali só daria
-- link vencido no cache de 60s da página.
--
-- Quem escreve é a agência — mesma regra do resto do editor de bio.
-- Limite e tipos ficam no bucket, não no navegador: a validação do cliente é
-- só para dar mensagem, o corte de verdade é aqui.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bio',
  'bio',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists bio_leitura_publica on storage.objects;
create policy bio_leitura_publica on storage.objects
  for select to public
  using (bucket_id = 'bio');

drop policy if exists bio_escrita_agencia on storage.objects;
create policy bio_escrita_agencia on storage.objects
  for all to authenticated
  using (bucket_id = 'bio' and public.is_agency())
  with check (bucket_id = 'bio' and public.is_agency());
