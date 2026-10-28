-- Fila: de onde o cliente veio
--
-- O atendente marca, em cada visita, como a pessoa chegou até o restaurante.
-- Fica na visita, não no cliente: a resposta pode mudar de uma vez para outra,
-- e o histórico conta por período. Para recorrente o app só sugere a última.
--
-- Nula de propósito: as visitas de antes desta coluna não têm a resposta. A
-- obrigatoriedade mora no app, que não deixa salvar visita nova sem ela.
--
-- Sem policy nova: as de `waiting_entries` já cobrem a coluna.

alter table public.waiting_entries
  add column if not exists source text
    check (source in ('ja_conhecia', 'google', 'instagram', 'tiktok', 'indicacao', 'outros'));

comment on column public.waiting_entries.source is
  'Como o cliente conheceu o restaurante, marcado pelo atendente. Nulo nas visitas anteriores a 2026-10-28.';
