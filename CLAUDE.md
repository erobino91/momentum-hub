# CLAUDE.md — Momentum Hub

Portal do cliente da MMT (`portal.mmtdigital.com.br`). Next.js 14 + TS + Tailwind 3 +
Supabase (`@supabase/ssr`), deploy Vercel região `gru1`.

## Antes de mexer

Ler `../MOMENTUM-HUB-PLANO.md` (raiz do workspace). São 8 fases (0–7), **uma por vez**:
ao fim de cada fase, parar, resumir e aguardar "go". Um commit por fase.

## Regras do projeto

- **`cookieOptions.domain` é o SSO.** Os três clients Supabase (browser, server,
  middleware) chamam `cookieOptionsPara(host)` de `src/lib/supabase/cookie-options.ts`.
  Nunca criar um client Supabase sem passar `cookieOptions` — quebra o login compartilhado
  com `fila.` e `cmv.`. A função só aplica o domínio quando o host atual pertence a ele:
  em `localhost` e `*.vercel.app` o cookie vira host-only, porque o navegador descarta
  `Set-Cookie` com `Domain` que não casa — e cookie descartado = login em loop.
- **No middleware, não rodar código nenhum entre `createServerClient` e `getUser()`.**
  Armadilha real do `@supabase/ssr`; o Fila de Espera já apanhou dela.
- **Anon key só no frontend.** Service/secret key nunca no bundle nem em `.env.local`
  versionado — só variável server-side (entra na Fase 3, para o CAPI do bio).
- **O slug do dashboard antigo é segredo.** Com ele qualquer um abre o `dash.html?c=<slug>`
  público. Fica em `entitlements.config.dashboard_slug`, a chamada à RPC sai do servidor
  (`src/lib/dashboard.ts`) e o payload que vira prop de Client Component é montado campo a
  campo — nunca espalhar a linha crua da RPC, que traz `slug` e ids junto.
- **RLS em toda tabela nova**, filtrando por `current_org_id()`.
- Migrations versionadas em `supabase/migrations/`, nunca DDL solto no painel.
- Nunca imprimir chaves ou segredos na saída, nem dentro de comandos.

## Base de reuso

Copiar padrões do `../Fila de Espera` (projeto mais maduro do workspace): clients
Supabase, `current_restaurant_id()` → vira `current_org_id()`, scripts
`scripts/verify-rls.mjs`, estrutura de migrations.

## Comandos

```bash
npm run dev      # local :3000
npm run build    # valida tipos — rodar antes de fechar qualquer fase
npm run lint
npm run verify   # Fases 1 e 2
npm run verify:fase1   # identidade, convites, isolamento por RLS
npm run verify:fase2   # dashboard: RPC antiga, vazamento de slug, números
```

O `verify:fase2` precisa do app respondendo para as checagens de ponta a ponta —
`npm run start` em outro terminal, ou `HUB_URL=<url>` apontando para o Vercel. Sem isso
ele pula essas linhas e diz que pulou.

## Migrations

Aplicadas pela API de gestão (`POST /v1/projects/{ref}/database/query`) com o token de
`.supabase-token.txt`. **Mandar o arquivo inteiro numa requisição devolve 400 sem corpo** —
enviar por seções, separadas pelas linhas `-- ------`. É o que o histórico da Fase 1 fez.

## Bootstrap da agência

O primeiro usuário `agency` não pode se criar sozinho (só agência escreve em `memberships`).
Ele nasce de um `invite` inserido via SQL; o trigger `accept_invites_for_new_user` converte
em membership no cadastro. Já feito para `luis_fossalussa@hotmail.com` na org `momentum-digital`.
