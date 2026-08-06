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

Migrations versionadas em `supabase/migrations/`.

| Tabela | Papel |
|---|---|
| `orgs` | o cliente da agência |
| `memberships` | quem pertence a qual org, com papel `owner`/`staff`/`agency` |
| `entitlements` | qual módulo está liberado para qual org |
| `invites` | email convidado → vira membership no cadastro, por trigger |

RLS em todas: leitura filtrada por `current_org_ids()`, escrita só para `is_agency()`.

## Como um cliente entra

1. Na área `/agencia`, a MMT cria a empresa e convida o email.
2. O cliente se cadastra em `/cadastro` com esse mesmo email.
3. O trigger `accept_invites_for_new_user` cria o membership sozinho.
4. Na home ele vê um card por módulo com `enabled = true`. Módulo desligado não aparece.

## Status

**Fase 1 concluída** — identidade, entitlements e RLS. `npm run verify` roda 12 checagens
de isolamento contra o banco real e limpa os dados de teste no fim.

Pendente da Fase 0: apontar o DNS. Enquanto isso o portal vive em
`momentum-hub-psi.vercel.app` e o SSO entre subdomínios fica inativo (por desenho —
ver `cookie-options.ts`).
