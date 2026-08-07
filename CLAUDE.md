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
- **Anon key só no frontend.** A chave secreta (`SUPABASE_SECRET_KEY`) passa por cima da
  RLS: só via `src/lib/supabase/secreto.ts`, nunca importada de Client Component. Ela
  existe porque a página pública do bio não tem sessão.
- **Roteamento por domínio lê o header `host`, não `nextUrl.hostname`.** Em `next start`
  o `nextUrl` é montado a partir da configuração do servidor e devolve sempre `localhost`
  — o roteamento de `bio.` nunca dispararia. Ver `src/middleware.ts`.
- **IP de visitante nunca é gravado cru** — só `sha256(BIO_IP_SALT:ip)`. Para a Meta,
  porém, `client_ip_address` e `client_user_agent` vão **sem hash**: são os dois campos
  que a CAPI exige em claro, e hasheá-los zera o casamento do evento.
- **O slug do dashboard antigo é segredo.** Com ele qualquer um abre o `dash.html?c=<slug>`
  público. Fica em `entitlements.config.dashboard_slug`, a chamada à RPC sai do servidor
  (`src/lib/dashboard.ts`) e o payload que vira prop de Client Component é montado campo a
  campo — nunca espalhar a linha crua da RPC, que traz `slug` e ids junto.
- **`restaurants.id` é sempre o `orgs.id` do mesmo cliente.** A tabela é uma extensão 1:1 de
  `orgs` para o módulo Fila de Espera, travada por FK `on delete restrict` — nunca gerar id
  novo ali. Quem enxerga as tabelas do Fila é quem tem `profiles`, **não** quem tem
  `membership`: membership decide SE o usuário chega ao módulo, `profiles` decide O QUE ele
  faz dentro. Por isso o balcão não tem membership — teria acesso org-wide e veria o
  dashboard de faturamento do dono.
- **As policies do Fila não têm ramo `is_agency()`, e é de propósito.** A agência não tem o
  que fazer com nome, telefone e data de nascimento dos clientes do salão. `verify:fase4`
  afirma isso explicitamente para ninguém adicionar o bypass por reflexo.
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
npm run verify   # Fases 1, 2, 3 e 4
npm run verify:fase1   # identidade, convites, isolamento por RLS
npm run verify:fase2   # dashboard: RPC antiga, vazamento de slug, números
npm run verify:fase3   # bio: RLS das 4 tabelas, clique, hash de IP, CAPI, host bio.
npm run verify:fase4   # fila: portal e agência leem 0 linhas, partner, FK, realtime
```

Os verifies das Fases 2 e 3 precisam do app respondendo para as checagens de ponta a ponta —
`npm run start` em outro terminal, ou `HUB_URL=<url>` apontando para o Vercel. Sem isso
eles pulam essas linhas e dizem que pularam.

O `verify:fase4` cobre o **banco**; o app do Fila é outro repo e tem a suíte dele, que roda
contra este projeto com `node scripts/run-suite.mjs --alvo hub` lá.

**Armadilha do `supabase-js` com realtime — vale para script E para app.** O canal conecta
como `anon`, a RLS barra tudo e parece realtime morto, mas o servidor responde o join com
`{"status":"ok"}` e o binding ecoado: nada indica erro, a tela só nunca se mexe. E é
intermitente, então passa por revisão e teste e aparece na mão do usuário — foi assim que
chegou ao balcão do Fila.

- **Em script:** passe a opção `accessToken` **e** `await cli.realtime.setAuth(token)`. Só a
  primeira e um listener de auth com sessão nula apaga o token; só a segunda e o token é
  setado num `.then()` que ninguém espera.
- **No app:** nunca `.subscribe()` na montagem. `await supabase.auth.getSession()` →
  `await supabase.realtime.setAuth(token)` → aí sim entrar no canal. O client lê a sessão do
  cookie de forma assíncrona e o `subscribe()` ganha a corrida com facilidade.
- Sempre refazer a busca ao (re)`SUBSCRIBED` e em `visibilitychange`: reconexão não reenvia o
  que passou enquanto o socket esteve fora.

## Migrations

`node scripts/aplicar-migration.mjs supabase/migrations/<arquivo>.sql`.

Aplicadas pela API de gestão (`POST /v1/projects/{ref}/database/query`) com o token de
`.supabase-token.txt`. **Mandar o arquivo inteiro numa requisição devolve 400 sem corpo** —
por isso o script corta nas linhas `-- ------` e manda seção por seção.

## Bootstrap da agência

O primeiro usuário `agency` não pode se criar sozinho (só agência escreve em `memberships`).
Ele nasce de um `invite` inserido via SQL; o trigger `accept_invites_for_new_user` converte
em membership no cadastro. Já feito para `luis_fossalussa@hotmail.com` na org `momentum-digital`.
