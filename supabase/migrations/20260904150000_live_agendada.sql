-- Agendar início e término da live.
--
-- Até aqui uma live começava no instante do clique e terminava no corte de
-- segurança de 3h50 (ou quando alguém desligava). Quem quisesse live às 19h
-- precisava estar na frente do computador às 19h.
--
-- Os dois horários são **opcionais**: nulos, tudo se comporta exatamente como
-- antes. Por isso nenhuma das duas colunas tem `default` — "sem horário" precisa
-- ser um estado que se lê, não um `now()` congelado no insert, que faria toda
-- live nascer parecendo agendada para o instante em que foi criada.
--
-- `encerrar_em` não reusa `auto_cutoff_at` de propósito. Os dois guardam
-- instantes parecidos e significam coisas opostas: `encerrar_em` é **intenção**
-- (vem do operador, antes de começar) e `auto_cutoff_at` é **consequência** (o
-- worker escreve na largada, como início + 3h50). Além de indistinguíveis se
-- morassem juntos, a primeira coisa que `startSession` faz é sobrescrever o
-- segundo — o término escolhido seria apagado na largada.

alter table public.live_sessions
  add column if not exists iniciar_em  timestamptz,
  add column if not exists encerrar_em timestamptz;

comment on column public.live_sessions.iniciar_em is
  'Quando a live deve subir. Nulo = agora (comportamento de sempre). No futuro, '
  'a sessão nasce com status `scheduled` e o worker a segura até a hora.';

comment on column public.live_sessions.encerrar_em is
  'Quando a live deve ser cortada. Nulo = só o corte de segurança. O worker grava '
  'em `auto_cutoff_at` o MENOR entre este valor e início + 3h50 — as 3h50 seguem '
  'sendo teto, não alvo.';

-- ---------------------------------------------------------------------------
-- Status novos
-- ---------------------------------------------------------------------------
--
-- `status` é texto livre (não há enum nem check nesta tabela), então isto é
-- documentação — mas documentação que importa, porque três estados entram agora:
--
--   scheduled  engatilhada, esperando a hora. É o que mantém a agendada fora do
--              radar de `tick()` e, principalmente, de `reconcile()` — que marca
--              todo `starting`/`live` órfão como `error` no boot. Uma agendada em
--              `starting` morreria a cada reinício do worker.
--   missed     a hora passou e o worker não estava de pé. Não é `error`: erro é
--              RTMP caindo, e misturar os dois manda procurar defeito onde só
--              houve um `.bat` fechado.
--   canceled   o operador desistiu antes de começar. Separado de `missed` porque
--              "eu cancelei" e "o sistema perdeu" pedem reações diferentes.

comment on column public.live_sessions.status is
  'starting | live | ending | ended | error | scheduled | missed | canceled. '
  'Os três últimos entraram com o agendamento: `scheduled` espera a hora, '
  '`missed` é hora perdida com o worker desligado, `canceled` é desistência.';
