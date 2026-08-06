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
| `DASHBOARD_SUPABASE_URL` | local + Vercel | URL do projeto antigo do dashboard |
| `DASHBOARD_SUPABASE_ANON_KEY` | local + Vercel | chave anon do projeto antigo |

As duas do dashboard **não** levam `NEXT_PUBLIC`: a chamada sai do servidor justamente
para o slug do cliente não chegar ao navegador.

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

## Dashboard (Fase 2)

`/dashboard` lê os dados do **projeto Supabase antigo** (`dashboard-agencia`), sem migrar
banco nenhum. O caminho:

1. A agência grava o slug do cliente no sistema antigo em
   `entitlements.config.dashboard_slug` (campo na área `/agencia`).
2. `src/lib/dashboard.ts` roda **no servidor**: confere sessão → confere
   `entitlements.enabled` → chama `get_public_dashboard(p_slug)` no projeto antigo.
3. Só campo conhecido volta para o navegador. `slug`, `client.id` e `client_id` ficam no
   servidor — quem tem o slug abre o `dash.html?c=<slug>` público sem login.

`/dashboard?org=<id>` mostra o dashboard de qualquer empresa, mas só para papel `agency`.

Os números são os mesmos do `dash.html`: faturamento total é recomposto de
mesa + delivery + iFood (nunca a coluna `fat_total`), ticket médio é faturamento ÷ pedidos,
ROAS é vendas ÷ investido, e a variação só aparece quando o mês anterior tem base > 0.

## Status

**Fases 1 e 2 concluídas.**

```bash
npm run verify         # as duas fases
npm run verify:fase1   # 12 checagens de identidade/RLS
npm run verify:fase2   # 15 checagens do dashboard
```

O `verify:fase2` compara 24 valores da tela contra as fórmulas do `dash.html` e confere que
o slug não aparece no HTML entregue. As checagens de ponta a ponta precisam do app no ar
(`npm run start`, ou `HUB_URL=https://portal.mmtdigital.com.br npm run verify:fase2`);
sem isso elas são puladas, e o script diz que foram.
