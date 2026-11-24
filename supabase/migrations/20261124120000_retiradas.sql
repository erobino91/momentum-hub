-- Retirada de venda antecipada (Black BB Onça, 26/11/2026)
--
-- Uma linha por pedido entregue no balcão. O pedido em si não mora aqui: vem do
-- Goomer na hora em que a página abre. Guardar só o id e o carimbo basta para o
-- relatório depois (quem retirou e a que horas) sem copiar nome e telefone.
--
-- Sem policy: só a página `/retirada/<slug>` grava e lê, pela chave secreta,
-- depois de conferir o PIN. `anon` e `authenticated` não veem nada.

create table if not exists public.retiradas (
  evento      text        not null,
  order_id    text        not null,
  retirado_em timestamptz not null default now(),
  primary key (evento, order_id)
);

alter table public.retiradas enable row level security;

comment on table public.retiradas is
  'Pedido retirado no balcão por evento de venda antecipada. Pedido vem do Goomer.';
