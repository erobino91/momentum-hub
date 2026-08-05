# CLAUDE.md — Momentum Hub

Portal do cliente da MMT (`portal.mmtdigital.com.br`). Next.js 14 + TS + Tailwind 3 +
Supabase (`@supabase/ssr`), deploy Vercel região `gru1`.

## Antes de mexer

Ler `../MOMENTUM-HUB-PLANO.md` (raiz do workspace). São 8 fases (0–7), **uma por vez**:
ao fim de cada fase, parar, resumir e aguardar "go". Um commit por fase.

## Regras do projeto

- **`cookieOptions.domain` é o SSO.** Os três clients Supabase (browser, server,
  middleware) importam de `src/lib/supabase/cookie-options.ts`. Nunca criar um client
  Supabase sem passar `cookieOptions` — quebra o login compartilhado com `fila.` e `cmv.`.
- **No middleware, não rodar código nenhum entre `createServerClient` e `getUser()`.**
  Armadilha real do `@supabase/ssr`; o Fila de Espera já apanhou dela.
- **Anon key só no frontend.** Service/secret key nunca no bundle nem em `.env.local`
  versionado — só variável server-side (entra na Fase 3, para o CAPI do bio).
- **RLS em toda tabela nova**, filtrando por `current_org_id()`.
- Migrations versionadas em `supabase/migrations/`, nunca DDL solto no painel.
- Nunca imprimir chaves ou segredos na saída, nem dentro de comandos.

## Base de reuso

Copiar padrões do `../Fila de Espera` (projeto mais maduro do workspace): clients
Supabase, `current_restaurant_id()` → vira `current_org_id()`, scripts
`scripts/verify-rls.mjs`, estrutura de migrations.

## Comandos

```bash
npm run dev     # local :3000
npm run build   # valida tipos — rodar antes de fechar qualquer fase
npm run lint
```
