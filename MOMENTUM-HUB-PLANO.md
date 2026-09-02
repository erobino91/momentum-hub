# Momentum Hub — Plano de Migração (handoff)

> Documento de referência para conduzir a construção do portal do cliente em um chat novo.
> Escrito para começar do zero: contém os fatos já levantados (refs, chaves, caminhos) para
> não precisar reexplorar o workspace. Última atualização: 2026-08-04.

---

## 1. O que é e por quê

Um **portal único** onde cada cliente da MMT loga uma vez (email + senha) e tem **os quatro
módulos**: dashboard de resultados, seus links rastreados (bio), fila de espera e CMV. O serviço
não é fragmentado — não existe cliente que "comprou" um módulo e não outro. O que varia é o
módulo já estar configurado para ele; enquanto não estiver, aparece como "em configuração".

Hoje o valor está espalhado (link solto do dashboard, fila num `.vercel.app`, CMV interno) e o
playbook de inauguração ainda manda **pagar tráfego para um Linktree de terceiro**. O portal
consolida tudo com a marca da agência, vira argumento comercial e de retenção, e o linktree próprio
elimina uma mensalidade externa **e** recupera o dado de conversão que hoje se perde.

### Decisões já fechadas com o cliente (Luis)
- Domínio: **`mmtdigital.com.br`** (já registrado, com acesso ao DNS).
- Login do cliente: **email + senha real**.
- Escopo v1: **dashboard + bio/linktree + Fila de Espera + CMV**.
- Tracking do bio: **cliques no banco + Pixel no browser + CAPI (server-side)**.
- Subdomínios:
  - `portal.mmtdigital.com.br` → o hub (novo)
  - **`bio.mmtdigital.com.br/<slug>`** → linktree próprio (novo)
  - `fila.mmtdigital.com.br` → Fila de Espera (existente, re-apontado)
  - `cmv.mmtdigital.com.br` → CMV (existente, auth trocada)
  - apex/`www` → LP atual (`lp-agencia`)

---

## 2. A arquitetura em uma frase

**SSO sem código de ponte, via cookie de domínio.** Um único projeto Supabase é dono da identidade;
todo app vira subdomínio de `mmtdigital.com.br`; todo client Supabase é criado com
`cookieOptions: { domain: '.mmtdigital.com.br' }`. Logou no portal → está logado em `fila.` e `cmv.`.
O cookie de sessão viaja sozinho. Zero rota de handoff, zero JWT customizado.

```
                    portal.mmtdigital.com.br      (hub — novo)
                    bio.mmtdigital.com.br/<slug>  (linktree — novo)
  cookie .mmtdigital.com.br  ──────────────►
                    fila.mmtdigital.com.br        (app existente, re-apontado)
                    cmv.mmtdigital.com.br         (app existente, auth trocada)

  Supabase `momentum-hub` (NOVO)  →  auth.users + orgs + module_config + bio + fila
  Supabase `dashboard`  (atual)   →  lido server-side pelo hub via RPC (fases 2), migrado na 6
  Neon (cmv)                      →  dados de negócio, permanecem intactos
```

**Consequência que orienta tudo:**
- O **Fila de Espera precisa migrar** de projeto Supabase — a RLS dele usa `auth.uid()`, e isso só
  funciona se auth e dados estiverem no MESMO projeto.
- O **CMV NÃO precisa migrar de banco** — ele só usa o Supabase para saber *quem é* o usuário; os
  dados continuam no Neon.
- **Vercel resolve toda a hospedagem. O hub não precisa de VPS.** VPS só entra (opcional, à parte)
  para o `lives-worker`.

---

## 3. Inventário de infraestrutura (fatos verificados)

### Supabase
| Projeto | Ref | Região | Uso hoje |
|---|---|---|---|
| dashboard-agencia | `mynolirdauvkubxvlddt` | — | dashboard + Lives |
| Fila de Espera | `shppauiuhlwletwywzjv` | `sa-east-1` | app de fila |
| APP Cross | `dtmextnjsuvtshqfwpao` | `sa-east-1` | fora do escopo do hub |
| **momentum-hub** | `gxhgcatcqdqgetkhuhcf` | `sa-east-1` | o hub (criado na Fase 0) |

- Free tier = 2 projetos ativos por conta. **Não é gargalo:** as contas são separadas — a conta
  do token de gestão tem só `appcross` + `momentum-hub`; dashboard e Fila vivem em outra conta.
- O projeto novo tem chaves legadas (JWT `anon`) **e** novas (`publishable`/`secret`). A anon legada
  funciona: `GET /rest/v1/` responde 401 (rota de OpenAPI fechada), mas query em tabela responde
  normal. Não confundir esse 401 com chave inválida.
- Egress **já estourou uma vez (jul/26)** — causa era o `lives-worker`, **já resolvido** pelo cliente.

### Vercel
- Conta `erobino91`, org `team_8ISYVt6y3GUeaXBxS81neXV8`.
- Projetos: `momentum-hub` (`prj_YWCuvw0fPjFcdJNvlrq3M7AlSxpc`), `momentum-lp`, `fila-espera`
  (`prj_JmDpAjJyIox5kFxhcilOS6n2AYHp`), `dash`, `app-cross`, `momentumcmv`.
- Provável plano Pro (app-cross usa crons diários).
- Automação: tokens locais em `momentum-hub/.supabase-token.txt` e `.vercel-token.txt` (gitignored)
  permitem operar as duas APIs de gestão sem painel. As CLIs (`vercel login`) não servem — exigem
  sessão interativa.

### Domínio
- `mmtdigital.com.br` registrado (aparece como e-mail em `lp-agencia/politica-privacidade.html`).
- Nenhum subdomínio apontado ainda hoje.

### Repos (GitHub, dono `erobino91`)
- `dashboards` → dashboard-agencia · `momentumcmv` → cmv · `filadeespera` → Fila de Espera
- `momentum-lp` → lp-agencia · `momentumdigital` → Momentum Digital (scripts Meta)

### App Meta próprio da MMT
- `META_APP_ID`/`META_APP_SECRET` em `Momentum Digital/.env`, com política de privacidade publicada
  na LP (já aprovado). **É este app que habilita o CAPI do bio** — não precisa criar outro.

---

## 4. ⚠️ Estado de segurança do dashboard — VERIFICADO EM 2026-08-04

Foi testado direto contra o banco `mynolirdauvkubxvlddt` com a chave pública. **A trava (Fase 2 do
`dashboard-agencia/supabase/rls-core.sql`) JÁ ESTÁ APLICADA.** Não repetir esse passo.

| Teste (anon/publishable key) | Resultado | Conclusão |
|---|---|---|
| `GET /rest/v1/clients?select=id` | **401** | leitura direta bloqueada |
| `GET /rest/v1/periods` | **401** | idem |
| `GET /rest/v1/pricing_products` | **401** | idem |
| RPC `get_public_dashboard` com slug falso | `null` | não vaza lista geral |
| RPC sem argumento | **404** | não dá para "pedir tudo" |

**Resíduo conhecido (não urgente):** o link do dashboard ainda é público por adivinhação do slug —
quem souber o slug de um cliente vê os números dele, sem senha. Não é vazamento em massa (é 1‑a‑1).
O **Passo 1 do hub fecha isso** ao colocar login na frente. Aceitável até lá.

---

## 5. Base de reuso (não reinventar)

O **Fila de Espera é o projeto mais maduro** do workspace (multi-tenant + RLS + migrations
versionadas + scripts de verificação). Copiar os padrões dele. Caminhos:

| O que reusar | Caminho | Para quê |
|---|---|---|
| Clients Supabase (browser/server/middleware) | `Fila de Espera/src/lib/supabase/*.ts` | base do auth do hub. **Adicionar `cookieOptions.domain`** |
| Padrão de sessão no middleware | `Fila de Espera/src/lib/supabase/middleware.ts` | atenção ao comentário "do not run any code between createServerClient and getUser()" — armadilha real |
| Função de tenant sem recursão de policy | migration de `Fila de Espera/supabase/migrations/` (`current_restaurant_id()`) | virar `current_org_id()` |
| Scripts de verificação | `Fila de Espera/scripts/verify-rls.mjs`, `verify-phase*.mjs` | rodar contra o banco novo na fase 4 |
| Migrations SQL versionadas | `Fila de Espera/supabase/migrations/` | modelo de estrutura (o dashboard NÃO tem isso) |
| RPC pública do dashboard | `dashboard-agencia/supabase/rls-core.sql:21-51` (`get_public_dashboard`) | consumida server-side na fase 2 |
| Render do dashboard | `dashboard-agencia/dash.html` | portar cálculos: ticket médio = `fat / pedidos`; deltas mês a mês |
| Playbook a atualizar | `Momentum Digital/intelligence/playbooks/inauguracao-loja.md` (seções 6.2 e "Campanha 2") | trocar `linktr.ee` por `bio.mmtdigital.com.br` |

### Onde o Clerk aparece no CMV (a troca é pequena)
- `cmv/proxy.ts:8-12` → `clerkMiddleware` vira `updateSession` (padrão `@supabase/ssr`).
  ⚠️ CMV usa **Next.js 16** — o middleware chama-se `proxy.ts` com export `proxy`. Ler
  `cmv/node_modules/next/dist/docs/` antes (instrução de `cmv/AGENTS.md`).
- `cmv/lib/actions/*.ts` → função `getUserId()` (`auth()` do Clerk) vira `supabase.auth.getUser()`.
  **Mesma assinatura `Promise<string>` → nenhuma query Prisma muda.** Extrair para um `cmv/lib/auth.ts` único.
- Páginas `/sign-in` e `/sign-up` → form Supabase ou redirect ao portal.
- Remover deps `@clerk/nextjs`, `@clerk/localizations`.

---

## 6. Passo a passo

> Regra: **uma fase por vez**. Ao fim de cada uma, parar, resumir, aguardar "go". Um commit por fase.

### Fase 0 — Infra e domínio ✅
1. ~~Apontar `mmtdigital.com.br` na Vercel.~~ ✅ O domínio **já estava** na Vercel (nameservers
   `ns1/ns2.vercel-dns.com`), com apex → redirect para `www` → `momentum-lp`, `dash.` → projeto
   `dash`, e MX do **Google Workspace** no zone — não mexer nisso, é o email da agência.
   `portal.` → `momentum-hub` e `fila.` → `fila-espera` atribuídos em 2026-08-06, verificados na hora.
   **`bio.` fica para a Fase 3** (não existe app ainda) e **`cmv.` para a Fase 5**: a instância de
   produção do Clerk é amarrada ao domínio, então trocar a URL antes de migrar a auth quebraria o login.
2. ~~Criar projeto Supabase `momentum-hub`, região `sa-east-1`.~~ ✅ ref `gxhgcatcqdqgetkhuhcf`.
3. ~~Repo novo `momentum-hub`: Next.js 14 + TS + Tailwind + Supabase.~~ ✅ `erobino91/momentum-hub`,
   Vercel `gru1`, `supabase/migrations/` vazio (schema entra na Fase 1).
4. **Entregável:** ✅ `https://portal.mmtdigital.com.br` no ar, `/api/health` →
   `{"ok":true,"supabase":"reachable"}`.

⚠️ **Supabase Auth vinha com `site_url = http://localhost:3000` e allow-list vazia** — link de
confirmação de email caía em localhost. Corrigido: `site_url = https://portal.mmtdigital.com.br` e
`uri_allow_list` com portal + `momentum-hub-psi.vercel.app` + localhost. **Todo domínio novo precisa
entrar nessa lista**, senão o redirect do email é recusado.

`NEXT_PUBLIC_COOKIE_DOMAIN=.mmtdigital.com.br` está setada na Vercel. Um `Set-Cookie` com `Domain`
que não casa com o host é descartado pelo navegador — ou seja, login em loop. Resolvido na Fase 1
com `cookieOptionsPara(host)`: o domínio só é aplicado quando o host pertence a ele. Em `localhost`
e `*.vercel.app` o cookie vira host-only e o login funciona; o SSO liga sozinho quando o DNS apontar,
sem mexer em env var.

### Fase 1 — Identidade e configuração de módulos ✅
Feito em 2026-08-06. Migrations `20260806120000_phase1_identity.sql` e
`20260806123000_phase1_invites.sql`. `npm run verify` = 12 checagens, todas passando.

> **Corrigido em 2026-08-07 — não existe módulo liberado por empresa.** A Fase 1 nasceu com
> `entitlements.enabled`, um interruptor por org e por módulo. Isso embutiu no produto uma
> decisão comercial que nunca existiu: **o serviço não é fragmentado, todo cliente tem
> acesso a todos os recursos**. A tabela virou `module_config` e perdeu o `enabled`; um
> módulo aparece pronto para o cliente quando o **recurso dele existe** (slug do dashboard,
> página de bio, restaurante preparado), respondido por `modulos_configurados(org)`. O que
> não está pronto aparece como **"em configuração"**, apagado e sem link — o cliente vê o
> produto inteiro e nunca esbarra em tela morta. Migration
> `20260807190000_fim_dos_entitlements.sql`.

Duas coisas saíram diferente do previsto abaixo, de propósito:
- **Tabela `invites` a mais.** Convidar pela Admin API exigiria a service key dentro do app.
  Em vez disso a agência grava um convite (email + org + papel) e o trigger
  `accept_invites_for_new_user` em `auth.users` converte em membership no cadastro. O hub
  segue usando só a chave anon.
- **`current_org_ids()` (setof) além do `current_org_id()` escalar.** As policies usam a
  versão de conjunto; o escalar ficou só como conveniência do app.

**Bootstrap:** o primeiro usuário `agency` não pode se criar sozinho. Nasce de um `invite`
inserido via SQL — já feito para `luis_fossalussa@hotmail.com` na org `momentum-digital`.

Schema no `momentum-hub`:

| Tabela | Papel |
|---|---|
| `orgs` | o cliente da agência. `id`, `name`, `slug`, `logo_url`, `primary_color` |
| `memberships` | `user_id` → `auth.users`, `org_id`, `role` (`owner` \| `staff` \| `agency`) |
| `module_config` | `org_id`, `module` (`dashboard`\|`bio`\|`fila`\|`cmv`), `config jsonb`. **Sem `enabled`** — configuracao, nao liberacao |

1. Função `public.current_org_id()` (SECURITY DEFINER, lê `memberships` por `auth.uid()`) — copiar
   padrão de `current_restaurant_id()`.
2. RLS em tudo: `org_id = current_org_id()`. Role `agency` enxerga todas as orgs (policy separada).
3. Login, logout, recuperação de senha — reusar `src/lib/supabase/*` do Fila.
   **Adicionar `cookieOptions: { domain: '.mmtdigital.com.br' }` nos três clients** (habilita o SSO).
4. Home do portal: grid de cards, um por módulo com `enabled = true`. Módulo desligado nem aparece.
5. Área `/agencia` (role `agency`): criar org, convidar usuário, ligar/desligar módulo.

**Verificação:** criar duas orgs com usuários distintos. Logar como A e tentar ler dados de B
(`supabase.from('orgs').select()` no console e via REST direto) → deve vir **vazio** (RLS filtrando),
não erro. Ligar/desligar um entitlement e confirmar que o card some da home.

### Fase 2 — Dashboard embutido (sem migrar o banco antigo ainda) ✅
Feito em 2026-08-06. `/dashboard` no hub, lendo o projeto antigo (`mynolirdauvkubxvlddt`)
pela RPC `get_public_dashboard`. Nenhuma migration — a Fase 2 não toca em banco.

Saiu diferente do previsto, de propósito:
- **Sem route handler.** A página é Server Component e busca direto em `src/lib/dashboard.ts`;
  o payload inteiro (todos os meses) vai de uma vez e a troca de mês é estado no cliente.
  Um endpoint a mais seria só mais superfície para proteger, sem ganho.
- **Recharts**, não Chart.js: componente declarativo, sem `ref` de canvas nem instância a
  destruir na troca de mês.
- **Tema escuro do portal**, não a cópia clara do `dash.html` — decisão de produto, para o
  portal não trocar de cara no meio. Layout, seções e **cálculos** são os mesmos.
- **`/dashboard?org=<id>` para papel `agency`** conferir o dashboard de qualquer cliente sem
  trocar de conta. Extra que barateia a conferência mensal.

⚠️ **O slug é um segredo.** Quem tem o slug abre `dash.html?c=<slug>` sem login. Por isso ele
mora em `module_config.config.dashboard_slug`, a chamada sai do servidor com
`DASHBOARD_SUPABASE_URL`/`DASHBOARD_SUPABASE_ANON_KEY` (sem `NEXT_PUBLIC`), e o payload que
vira prop de Client Component é montado campo a campo — espalhar a linha da RPC levaria o
slug junto para o RSC, que é visível no DevTools.

**Verificação:** `npm run verify:fase2` — 15 checagens, todas passando com o app no ar.
Cobre a RPC antiga, o lockdown do anon nas tabelas antigas (401 em `clients` e `periods`),
o isolamento do `config` por RLS, os **24 valores da tela conferidos contra as fórmulas do
`dash.html`** no mesmo mês, e a ausência do slug no HTML entregue — inclusive na visão da
agência.

**Ainda por fazer (operacional, não código):** preencher o `dashboard_slug` de cada cliente
em `/agencia` e só então desativar o link público antigo, um cliente por vez.

### Fase 3 — Bio / linktree próprio + tracking (maior retorno) ✅
Feito em 2026-08-06. Migration `20260806140000_phase3_bio.sql`, aplicada por
`scripts/aplicar-migration.mjs`. `npm run verify:fase3` = 21 checagens, todas passando.

Saiu diferente do previsto abaixo:
- **O `event_id` do PageView nasce no navegador, não no servidor.** O plano pedia página
  cacheada *e* event_id por pageview — as duas coisas juntas não fecham: um id gerado no
  servidor seria repetido para todo mundo que pegasse a mesma cópia do cache, e a Meta
  contaria vários pageviews como um. O snippet do Pixel gera o id inline, e um beacon
  (`/api/bio/pv`) leva esse mesmo id para a CAPI. A página segue cacheada (60s).
- **Para a Meta, IP e User-Agent vão SEM hash.** O plano dizia "IP e UA hasheados";
  `client_ip_address` e `client_user_agent` são justamente os dois campos que a CAPI
  exige em claro — hasheados, o evento não casa com ninguém e vira lixo. O que a LGPD
  pede é não *guardar* o IP, e isso é respeitado: no nosso banco só entra
  `sha256(BIO_IP_SALT:ip)`.
- **Quem monta a bio é a agência, não o cliente.** O plano previa "editor de botões" no
  painel do cliente; o modelo de operação da MMT é o contrário — a agência configura tudo
  (slug, botões, Pixel, token) e o cliente entra para acompanhar, igual ao dashboard.
  Escrita em `link_pages`/`link_buttons` exige `is_agency()` (migration
  `20260806160000`), e o cliente vê a bio montada + o relatório, sem campo editável.
  Consequência prática: ao criar a página, a agência **escolhe a empresa** — senão a bio
  nasceria dentro da org `momentum-digital` e o relatório ficaria no lugar errado.
- **Ordenação por arrastar sem biblioteca** — HTML5 nativo, para não trazer dependência
  de drag-and-drop por causa de uma lista de 4 botões.
- **`link_clicks.rotulo`** guarda o texto do botão no momento do clique, e `button_id` é
  `on delete set null`: apagar um botão não pode reescrever o relatório do mês passado.
- **Sem tabela de pageviews.** O plano não pediu, e o relatório é de cliques. Se um dia
  quisermos taxa de conversão da página, é aí que entra.

⚠️ **Roteamento por domínio lê o header `host`, não `nextUrl.hostname`** — em `next start`
o `nextUrl` devolve sempre `localhost` e a reescrita de `bio.` nunca dispara. Foi bug real,
pego pelo verify.

**No ar em 2026-08-06.** `bio.mmtdigital.com.br` atribuído ao projeto `momentum-hub` — o
zone já tinha `ALIAS *` apontando para a Vercel, então **nenhum registro novo foi criado** e
os 5 MX do Google Workspace ficaram intactos (conferidos antes e depois). `npm run verify:fase3`
roda 26/26 contra produção.

**Falta por cliente (não é código):** preencher o ID do Pixel e gerar o token de CAPI no
Gerenciador de Eventos da Meta, colando no painel.

Schema:

| Tabela | Colunas |
|---|---|
| `link_pages` | `org_id`, `slug` unique, `title`, `bio`, `avatar_url`, `theme jsonb`, `pixel_id`, `active` |
| `link_buttons` | `page_id`, `label`, `url`, `icon`, `position`, `active`, `starts_at`, `ends_at` |
| `link_clicks` | `button_id`, `page_id`, `clicked_at`, `ip_hash`, `ua`, `referrer`, `fbclid`, `country`, `city` |
| `link_secrets` | `page_id`, `capi_token` — **RLS nega tudo; só service role lê** |

1. Página pública `bio.mmtdigital.com.br/<slug>`: server-rendered, sem auth, cacheada. Pixel do
   cliente no `<head>`. Gera um `event_id` por pageview.
2. Clique → rota **`/r/<button_id>` no servidor** (não `href` direto):
   a. Grava em `link_clicks` (**IP hasheado com salt — LGPD; nunca IP cru**).
   b. Dispara **CAPI** pro pixel do cliente com `fbc` (do `fbclid`), `_fbp`, IP e UA hasheados e o
      **mesmo `event_id`** do Pixel do browser → é o que faz a Meta **deduplicar** em vez de contar 2x.
   c. 302 pro destino.
3. `capi_token` por pixel (gerado no BM do cliente) fica em `link_secrets`, lido só via service role.
   **Nunca no bundle do client.**
4. Painel no hub: editor de botões (drag pra ordenar), preview ao vivo, relatório de cliques por
   botão/período. Rodar skill `dataviz` antes de desenhar gráficos.
5. Atualizar o playbook de inauguração (seções 6.2 e "Campanha 2") → apontar pro bio próprio.

**Verificação:** `npm run verify:fase3` cobre o lado do código — as 4 tabelas fechadas para
`anon`, o `capi_token` invisível até para o dono, isolamento entre orgs, a URL de destino
fora do HTML, o clique gravado com IP hasheado (conferido contra `sha256(sal:ip)`), botão
fora da janela sem gravar clique, o `event_id` nascendo no navegador, e **o redirecionamento
acontecendo mesmo com token de CAPI inválido** (falha da Meta não pode segurar o usuário).

O que só dá para conferir com pixel real, depois do passo 2 acima: abrir o Gerenciador de
Eventos da Meta e ver o clique chegando com status **"Deduplicado"** — se vier "duplicado",
o `event_id` não bateu entre navegador e servidor. E repetir com bloqueador de anúncio
ligado: o evento tem que aparecer mesmo assim, vindo só do servidor.

### Fase 4 — Fila de Espera dentro do hub (migração de banco — a mais delicada) — **FEITA em 07/08/2026**
Corte executado com a fila vazia. `fila.mmtdigital.com.br` roda no banco do hub, card liberado no portal,
logins do projeto antigo bloqueados.

**Situação em 25/08/2026:** o projeto antigo (`shppauiuhlwletwywzjv`) **saiu do ar sozinho** — o hostname
não resolve mais, igual ao que aconteceu com o `mynolirdauvkubxvlddt` do dashboard. Os dois moram na
segunda conta Supabase (org `deuacupwtffrphijpjbt`), que nenhum token deste workspace enxerga: o
`.supabase-token.txt` do hub só lista `appcross` e `momentum-hub`. **O delete formal precisa ser clicado
no painel logado naquela conta** — é PII real, e fora do ar não é o mesmo que apagado (projeto pausado
volta). Por isso os pinos de rollback do repo do Fila continuam de pé: `.projeto-antigo.env`, o perfil
`"fila"` do `projetos.mjs`, `projeto-antigo.mjs` e `migrate-to-hub.mjs`.

**Sobras achadas e corrigidas no dia 25/08:** o corte trocou as env vars da Vercel e esqueceu o disco —
`Fila de Espera/.env.local`, `.supabase-db-password.txt` e `supabase/.temp/` ficaram 18 dias apontando
para o projeto morto. `npm run dev` ali falava com um domínio inexistente, e `apply-sql.mjs` /
`create-partner-user.mjs` tiram o ref do `.env.local`, então miravam lá também. Produção nunca sentiu —
que é justamente por que ninguém viu.

**Migra o banco, não o app.** O Fila continua no repo e no projeto Vercel dele; o que muda são
env vars. Fundir os dois repos foi descartado: o Fila é um PWA de tablet em uso no balcão, e
acoplá-lo ao deploy semanal do hub põe a operação do cliente em risco sem ganho nenhum — eles
só precisam dividir **banco e cookie**.

1. Rodar as 7 migrations do Fila no `momentum-hub`, mais uma oitava com a FK de tenancy.
2. Tenancy: **`restaurants.id` passa a ser o `orgs.id`** (FK `on delete restrict`), tabela mantida.
   Repontar tudo para `orgs` e matar `restaurants` foi descartado: obrigaria o balcão a ter
   `membership`, e membership é org-wide — o caixa passaria a enxergar o dashboard de faturamento
   do dono. `profiles` e `memberships` convivem: **membership decide SE o usuário chega ao módulo,
   `profiles` decide O QUE ele faz dentro**.
3. Copiar dados com `Fila de Espera/scripts/migrate-to-hub.mjs` — origem e destino são parâmetros,
   e é isso que permite rodar no sentido inverso no rollback. UUID e hash bcrypt preservados
   (ninguém troca de senha); `restaurant_id` remapeado.
4. Trocar as 3 env vars de produção do projeto Vercel `fila-espera` **antes** do merge —
   `NEXT_PUBLIC_*` é embutido no build.
5. `fila.mmtdigital.com.br` já está atribuído desde a Fase 0. Reinstalar o PWA do tablet a partir
   dele (foi instalado do `.vercel.app`, então hoje fica fora do SSO — o que não faz falta).
6. `npm run verify:fase4` no hub + `node scripts/run-suite.mjs --alvo hub` no Fila.
7. Bloquear os dois logins no projeto antigo (`banned_until`) no dia do corte, para nada gravar lá
   em silêncio e o CLI do parceiro falhar alto. Desativar o projeto antigo em 30 dias — **vai pro
   calendário; o modo de falha realista é esquecer**, e é PII real.

**Fora de escopo:** a Fase 9 do Fila (Google Sheets) continua pendente e **não** entra no hub.

**Verificação:** fila ativa em duas abas confirmando que o Realtime propaga. Logar no portal e navegar
pra `fila.mmtdigital.com.br` **sem passar por login** = teste do SSO.

### Fase 5 — CMV simplificado (Clerk → Supabase, banco Neon intacto) — **FEITA em 13/08/2026; módulo entregue ao cliente em 01/09/2026**
`cmv.mmtdigital.com.br` no ar com a identidade do hub; Clerk removido do código, das deps e das env
vars da Vercel. `npm run verify:auth` (no repo do CMV) faz dois logins reais e prova que a tela de um
usuário não mostra o dado do outro — rodou verde contra produção. **O card no portal acendeu em 01/09/2026**, com duas
mudanças que a entrega exigiu: o dado do CMV passou a ser **por empresa** (`orgId`, carimbado nas
seis tabelas do Neon por `scripts/escopar-por-org.mjs`; `userId` fica como registro de quem criou), e
a agência ganhou leitura do CMV de qualquer cliente pelo seletor da barra lateral ou pelo link
`/ver-empresa?org=` do painel — sem escrever em nenhum. O CMV é o único módulo **sem configuração**:
quem preenche insumo, receita e produto é o cliente, então o card acende assim que o módulo existe
(flag `semConfiguracao` em `src/lib/modules.ts`) — esperar "ter dado" trancaria do lado de fora quem
tem de criar o primeiro insumo.
Detalhes que valem: as contas que só existiam no Clerk viraram usuários do hub e o `userId` das
tabelas foi remapeado para o UUID (`cmv/scripts/remapear-usuarios.mjs`, idempotente); o cache passou
a ter o `userId` na chave **e** na tag. Não há cadastro nem recuperação de senha no CMV — isso é do
portal.

1. Trocar `proxy.ts` (ver §5) — ler `node_modules/next/dist/docs/` antes (Next 16).
2. `getUserId()` → `supabase.auth.getUser()`. Assinatura idêntica; nenhuma query Prisma muda.
   Extrair para `cmv/lib/auth.ts`.
3. Remapear a coluna `userId`: passa a guardar o UUID do Supabase (era o id do Clerk). `UPDATE` por
   usuário existente — base pequena, é ferramenta interna.
4. Remover deps Clerk; ajustar `/sign-in` e `/sign-up`.
5. **Tratar 2 riscos ANTES de expor a cliente externo:**
   - **Cache com tag global:** `unstable_cache(..., ["mps"], { tags:["mps"] })` + `revalidateTag("mps")`
     invalida de todos. Escopar por usuário: `mps:${userId}`.
   - **Isolamento só na aplicação (sem RLS — é Neon):** um `where:{userId}` esquecido vaza entre
     clientes. **Auditar todas as actions em `cmv/lib/actions/`.** Se algum ficar em dúvida, não
     liberar o módulo até revisar.

**Verificação:** `npm run build` (pega erro de tipo, onde a troca de auth quebra). Logar no portal →
`cmv.mmtdigital.com.br` direto. Criar matéria-prima com usuário A, logar como B, confirmar que não aparece.

### Fase 6 — Consolidação e limpeza — **FEITA em 13/08/2026 (falta só o corte do link público)**
Tudo do projeto antigo mora no hub: `dashboard_periods` (23 meses), `pricing_*` (96 produtos),
`live_materials`/`live_sessions` e os dois buckets. `npm run verify:fase6` confere **linha a linha**
pelo id (a cópia preserva o UUID), mais RLS e bucket. Telas novas: `/agencia/[org]/periodos`,
`/agencia/[org]/precificacao` e `/agencia/lives`.

Decisões que mudaram o plano original:
1. **As Lives vieram junto** (o plano mandava esperar a Fase 7). Sem elas, o projeto Supabase antigo
   não morreria: `live_sessions` e o bucket `materials` moravam lá. A Fase 7 fica sendo só a VPS.
2. **`clients` deixou de ser identidade** — cada cliente é uma `org`, como `restaurants.id = orgs.id`
   na Fase 4. `is_active` não veio: quem não deve ver o dashboard é quem não tem membership.
3. **"Dashboard configurado" virou "tem mês publicado"**, não mais "tem slug preenchido".
4. **Bucket `materials` era público** — qualquer mp4 de cliente abria por link direto. Agora é
   privado, e a coluna guarda caminho em vez de URL; worker e painel assinam na hora.
5. `pricing.html` veio junto (não estava no plano) porque some com o projeto antigo.

**Corte feito em 24/08/2026.** `dash.mmtdigital.com.br` deixou de servir o dashboard antigo e virou
**redirect 308 para o portal** — link velho de WhatsApp cai na tela de login em vez de 404, e o acesso
se resolve um cliente por vez. O projeto Vercel `dash` foi apagado (o código continua no repo
`dashboards`). O projeto Supabase antigo já não resolve DNS: sumiu entre 14/08 e 24/08, sem ter sido
apagado por aqui — o token deste repo nunca o enxergou, ele vive em outra conta.

Por isso o `verify:fase6` **pula** a comparação com o projeto antigo quando ele não responde, em vez
de morrer no meio: o que ele tem de mais importante — RLS, isolamento, bucket privado — vem depois
dessa parte.

### Fase 7 — VPS das Lives (separado, NÃO bloqueia o hub)
O hub não precisa de VPS. O que precisa de máquina 24/7 é o `lives-worker` (ffmpeg RTMPS), hoje refém
da máquina do Luis estar ligada — mesmo problema que o `oracle-sniper` tentou e falhou (514 tentativas,
sem capacidade, encerrado 17/07). Recomendação: alugar VPS barato (Hetzner CX22 ~€4/mês ou Contabo),
subir com `pm2` + systemd. Bônus (já previsto em `dashboard-agencia/LIVES.md`): IP dedicado em vez de
todas as lives saindo do mesmo IP residencial.

### Fase 9 — Financeiro no painel (mensalidade e vencimento) — **FEITA em 25/08/2026**
O painel sabia dizer se o cliente tem dashboard publicado e quem entra no portal; não sabia
dizer **quanto ele paga, quando vence e se pagou**. Agora sabe: `/agencia/financeiro` (o mês
inteiro, com geração, marcar pago, desfazer e cancelar) e uma aba **Financeiro** por empresa
(contrato, reajustes, últimas 12 cobranças). `npm run verify:fase9` = 40 checagens.

Três decisões que valem mais que o código:

1. **O contrato não guarda valor.** `billing_values` guarda `(valor, vigente_desde)` e reajuste
   é linha nova. Uma coluna `valor_atual` seria a segunda verdade, e quando as duas
   discordassem ninguém saberia qual acreditar.
2. **A cobrança do mês é materializada, com o valor congelado na geração.** Derivar do contrato
   de hoje era o caminho tentador e errado: quem pausa em setembro precisa continuar mostrando
   agosto, e quem foi reajustado em julho precisa que junho continue valendo o preço antigo.
3. **Não existe status "atrasado".** É `pendente` com vencimento no passado, calculado na
   leitura. Gravado, envelheceria calado — ninguém roda o job que o viraria, e a tela passaria
   a mentir sem dar sinal.

Sem cron: `gerar_cobrancas()` é idempotente e a geração é um botão na tela que a agência abre
uma vez por mês de qualquer jeito. `vencimento_do_mes()` corta o dia 31 no último dia do mês.

**ASAAS ficou de fora, e o modelo já cabe nele.** A cobrança é uma linha com id, valor,
vencimento e status próprios — o formato de um pagamento no ASAAS. A integração acrescenta
`asaas_payment_id` e uma rota de webhook, sem mudar tabela nem tela. Nenhuma coluna morta
entrou agora: o projeto já carrega um `fat_proprio` que nenhuma tela lê e não quer o segundo.

**Fora de escopo:** emitir boleto/PIX, avisar o cliente da cobrança, o cliente ver a
mensalidade no portal, cron de geração.

---

## 7. Teste ponta a ponta (fim do projeto)
~~Um cliente real com dashboard + bio liberados e fila desligada → dois cards, e `fila.` na mão
devolve 403.~~ **Escrito antes da correção da Fase 1 e não vale mais:** não existe módulo
liberado para um cliente e não para outro. O teste certo é o cliente ver os quatro cards, com
os não configurados dizendo "em configuração" — e clicar em cada card configurado tem de chegar
em algo que funciona, não em uma linha que existe (foi assim que a BB Onça teve o card de Bio
aceso apontando para um 404).

---

## 8. Custos
| Item | Situação |
|---|---|
| Domínio | já pago |
| Vercel | conta existente (provável Pro) |
| Supabase | free tier cabe pós-consolidação; Pro $25/mês se o egress apertar |
| VPS lives | ~€4/mês, novo, opcional e independente |
| Linktree externo | **economia — deixa de existir** |

## 9. Fora de escopo
- Fase 9 do Fila (Google Sheets)
- Migrar o módulo Lives pro hub (fica no dashboard-agencia)
- App nativo / PWA do portal
- Cobrança/assinatura dentro do hub

---

## 10. Como retomar em um chat novo
1. Abrir este arquivo primeiro.
2. Trabalhar **uma fase por vez**; ao fim de cada, parar e aguardar "go".
3. Segurança do dashboard **já verificada** (§4) — não repetir a Fase 2 do `rls-core.sql`.
4. Consultas ao Meta: usar a conexão própria (scripts Node + token `.env` em `Momentum Digital/`),
   **nunca** o MCP do Meta Ads.
5. Toda extração/arquivo: incluir data no nome (`nome-AAAA-MM-DD.csv`); nunca imprimir chaves/segredos.
