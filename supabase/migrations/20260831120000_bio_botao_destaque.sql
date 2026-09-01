-- Bio: o botão principal da página
--
-- O layout "Vitrine" precisa saber qual link é O link — ele vira o cartão cheio
-- da cor de destaque, e os outros ficam neutros com um filete. Convenção do
-- tipo "o primeiro da lista é o CTA" não serviria: restaurante com duas
-- unidades tem dois botões principais e eles não são vizinhos na ordem.
--
-- Nasce `false` em todo botão que já existe: página publicada não muda de cara
-- sozinha no deploy.

alter table public.link_buttons
  add column if not exists destaque boolean not null default false;
