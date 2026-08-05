# Momentum Hub

Portal único do cliente da Momentum Digital — `portal.mmtdigital.com.br`.
O cliente loga uma vez e vê só os módulos liberados para ele: dashboard, bio/linktree,
fila de espera e CMV.

Plano completo (8 fases, uma por vez): `../MOMENTUM-HUB-PLANO.md`.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind 3 · Supabase (`@supabase/ssr`) · Vercel `gru1`.

## SSO entre subdomínios

Todo client Supabase é criado com `cookieOptions.domain = .mmtdigital.com.br`
(`src/lib/supabase/cookie-options.ts`). O cookie de sessão gravado no portal viaja
para `fila.` e `cmv.` sozinho — não existe rota de handoff nem JWT customizado.

Em `localhost` a variável fica vazia e o cookie volta a ser host-only.

## Rodar local

```bash
npm install
cp .env.local.example .env.local   # preencher URL + anon key
npm run dev
```

- App: http://localhost:3000
- Health check: http://localhost:3000/api/health → `{"ok":true,"supabase":"reachable"}`

## Variáveis de ambiente

| Nome | Onde | Valor |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local + Vercel | URL do projeto `momentum-hub` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local + Vercel | chave publishable/anon |
| `NEXT_PUBLIC_COOKIE_DOMAIN` | **só Vercel** | `.mmtdigital.com.br` |

A service/secret key não entra aqui. Ela só aparece na Fase 3 (CAPI do bio), server-side.

## Banco

Migrations versionadas em `supabase/migrations/`. Vazio na Fase 0 — o schema
(`orgs`, `memberships`, `entitlements`) entra na Fase 1.

## Status

**Fase 0 — Infra e domínio.** Entregável: `portal.mmtdigital.com.br` servindo um
"em breve" + Supabase de pé. Sem produto ainda.
