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
| `SUPABASE_SECRET_KEY` | local + Vercel | chave **secreta** do hub — passa por cima da RLS |
| `BIO_IP_SALT` | local + Vercel | sal do hash de IP dos cliques |
| `NEXT_PUBLIC_BIO_URL` | opcional | domínio da bio exibido no painel |

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
| `link_pages` | a página de bio da org |
| `link_buttons` | os botões, com ordem e agendamento |
| `link_clicks` | um registro por clique (IP hasheado) |
| `link_secrets` | token de CAPI — RLS nega para todo mundo, só a chave secreta lê |

RLS em todas: leitura filtrada por `current_org_ids()`, escrita só para `is_agency()` nas
quatro da Fase 1. Nas tabelas do bio **o cliente escreve** (bio e botões são conteúdo
dele), e nenhuma delas é visível para `anon`.

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

## Bio / linktree (Fase 3)

Página pública em `bio.mmtdigital.com.br/<slug>`, editada em `/bio` no portal.

Por que não Linktree: em ferramenta de terceiro o clique não é medido e a Meta não recebe
evento nenhum. Aqui o Pixel do cliente carrega na página, cada clique é contado e o mesmo
evento sai também **pelo servidor** (Conversions API) — o caminho que sobrevive a
bloqueador de anúncio.

Como o clique funciona:

1. O botão não aponta para o destino: aponta para `/r/<button_id>`.
2. Antes de navegar, o navegador dispara `BioClick` no Pixel com um `event_id`.
3. `/r/<id>` grava o clique, manda o **mesmo `event_id`** pela CAPI e devolve 302.
   A Meta vê os dois eventos com o mesmo id e conta **um**.

O `event_id` nasce no navegador de propósito: a página tem cache de 60s, e um id gerado no
servidor seria repetido para todo mundo que pegasse a mesma cópia.

Quatro tabelas: `link_pages`, `link_buttons`, `link_clicks` e `link_secrets`. **Nenhuma é
legível pelo papel `anon`** — quem lê é o servidor, com a chave secreta. `link_secrets`
(o token de CAPI) não tem policy nenhuma: nem o dono da página lê o próprio token de volta.

LGPD: o IP do visitante **nunca** é gravado cru, só `sha256(BIO_IP_SALT:ip)`. Para a Meta,
`client_ip_address` e `client_user_agent` vão sem hash — são os dois campos que a CAPI
exige em claro.

## Status

**Fases 1, 2 e 3 concluídas.**

```bash
npm run verify         # as três fases
npm run verify:fase1   # 12 checagens de identidade/RLS
npm run verify:fase2   # 15 checagens do dashboard
npm run verify:fase3   # 21 checagens do bio
```

O `verify:fase2` compara 24 valores da tela contra as fórmulas do `dash.html` e confere que
o slug não aparece no HTML entregue. As checagens de ponta a ponta precisam do app no ar
(`npm run start`, ou `HUB_URL=https://portal.mmtdigital.com.br npm run verify:fase2`);
sem isso elas são puladas, e o script diz que foram.
