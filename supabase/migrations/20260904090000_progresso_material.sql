-- Progresso da conversão de material de live.
--
-- Até aqui "convertendo" era um selo binário: o painel sabia que o worker tinha
-- trabalho pela frente, mas não se ele estava andando, devagar ou morto. Na
-- noite de 03/09 a janela do worker congelou (QuickEdit do console do Windows) e
-- um material teria ficado preso nesse selo até alguém desconfiar.
--
-- Duas colunas, e a segunda é a que importa: `progresso` sozinho não separa
-- "convertendo devagar" de "worker caiu" — uma barra parada em 12% é idêntica
-- nos dois casos. `progresso_em` diz quando aquele número foi escrito, e é o
-- carimbo que deixa a tela dizer "parado há 4 min" em vez de mentir por omissão.

alter table public.live_materials
  add column if not exists progresso    smallint,
  add column if not exists progresso_em timestamptz;

comment on column public.live_materials.progresso is
  'Conversão do ffmpeg, 0-100. Nulo fora da conversão. Quem escreve é o worker.';

comment on column public.live_materials.progresso_em is
  'Quando `progresso` foi escrito. Sem isto não há como distinguir conversão '
  'lenta de worker parado.';
