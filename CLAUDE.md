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
- **Os números do dashboard moram aqui desde a Fase 6.** Saíram do projeto
  `mynolirdauvkubxvlddt` para `dashboard_periods`, e o slug secreto deixou de ser o que
  separa um cliente do outro — agora é a RLS. O payload de `src/lib/dashboard.ts` continua
  montado campo a campo: ele vira prop de Client Component e viaja no RSC, então a linha
  crua (com `id` e `org_id`) não sai de lá.
- **Precificação e Lives são da agência, não do cliente.** `pricing_products`,
  `pricing_config`, `live_materials` e `live_sessions` têm policy `is_agency()` sem ramo de
  org: nenhuma tela de cliente lê essas tabelas. `live_sessions.stream_key` é a chave da
  transmissão do Instagram do cliente — não entra em `select` de página nenhuma; quem
  precisa dela é o `lives-worker`, que lê com a chave secreta.
- **Bucket `materials` é privado e a coluna guarda caminho, não URL.** No projeto antigo ele
  era público e o mp4 de qualquer cliente abria por link direto. `source_url`/`file_url` de
  `live_materials` guardam `<org>/raw/arquivo.mp4`; worker e painel assinam a URL na hora.
  Guardar URL pública ali seria guardar link que não abre.
- **`restaurants.id` é sempre o `orgs.id` do mesmo cliente.** A tabela é uma extensão 1:1 de
  `orgs` para o módulo Fila de Espera, travada por FK `on delete restrict` — nunca gerar id
  novo ali. Quem enxerga as tabelas do Fila é quem tem `profiles`, **não** quem tem
  `membership`: membership decide SE o usuário chega ao módulo, `profiles` decide O QUE ele
  faz dentro. Por isso o balcão não tem membership — teria acesso org-wide e veria o
  dashboard de faturamento do dono.
- **As policies do Fila não têm ramo `is_agency()`, e é de propósito.** A agência não tem o
  que fazer com nome, telefone e data de nascimento dos clientes do salão. `verify:fase4`
  afirma isso explicitamente para ninguém adicionar o bypass por reflexo.
- **Não existe módulo "liberado" para um cliente e não para outro.** O serviço não é
  fragmentado: todo cliente tem os quatro módulos. O que varia é o módulo estar
  **configurado** — e isso é derivado do recurso existir (slug do dashboard preenchido,
  página de bio criada, restaurante preparado), nunca um estado marcado na mão. Quem
  responde é `modulos_configurados(org)`; `module_config` só guarda configuração. Se
  aparecer a vontade de "desligar só para este cliente", é a ideia errada voltando: o
  caminho é não configurar ainda, e o cliente vê **"em configuração"**.
- **`fila` é por usuário, não por empresa.** Quem clica no card é uma pessoa, e o acesso
  ao Fila vem de `profiles`. Restaurante existir com o dono ainda sem `profiles` acende o
  card para levar a "esta conta não atende nenhum restaurante" — por isso `prepararFila`
  cria os dois.
- **RLS em toda tabela nova**, filtrando por `current_org_id()`.
- Migrations versionadas em `supabase/migrations/`, nunca DDL solto no painel.
- Nunca imprimir chaves ou segredos na saída, nem dentro de comandos.

## Interface (Fase 8)

Os tokens moram em `src/app/globals.css` e são mapeados em `tailwind.config.ts`. As
primitivas ficam em `src/components/ui/` — **código novo usa elas**, não classe solta.

- **Token em canal RGB, não em hex.** `--brand: 227 27 27`, mapeado como
  `rgb(var(--brand) / <alpha-value>)`. É o que faz `bg-brand/15` funcionar: com o valor em
  `var(--x)` cru, o Tailwind 3 **não gera a regra** e a classe some sem erro — foi o que
  acontecia com `bg-accent/15` no selo de "pronto" da `/agencia`.
- **Vermelho da marca é `#E31B1B`** (o mesmo da `lp-agencia`), com branco por cima. Como
  texto no escuro ele reprova em contraste (4,1:1) — para isso existe `brand-ink`
  (`#FF5A5A`, 6,4:1).
- **Marca ≠ perigo.** Vermelho preenchido só na ação principal (uma por tela), no símbolo,
  na aba ativa e no anel de foco; nunca em selo de estado. Em lista, quem apaga é a variante
  `destrutivo` (neutra até o hover) dentro de `ConfirmarAcao` — o vermelho cheio de apagar só
  aparece dentro do diálogo, com a intenção já declarada.
- **Nada destrutivo sem `ConfirmarAcao`.** Use `digite="<palavra>"` no que não dá para
  desfazer (apagar mês, apagar empresa).
- **Todo formulário envia por `BotaoEnviar`**, que mostra o estado de envio. Só um formulário
  do projeto fazia isso antes.
- **Rótulo visível sempre** (`Campo`), nunca só `placeholder`. Campo tem 16px no celular:
  abaixo disso o Safari do iPhone dá zoom sozinho ao focar.
- `campoClasse` e `botaoClasse` continuam exportados de `auth-shell.tsx` só para as telas
  ainda não migradas. Não usar em código novo.
- **Nome de cor não pode colidir com utilitária do Tailwind.** A superfície de fundo chama-se
  `canvas`, não `base`: com `colors.base`, o Tailwind emite um `.text-base` de **cor** depois
  do `.text-base` de tamanho de fonte, e todo texto com essa classe vira quase preto. Vale
  para qualquer nome novo — `text-*`, `font-*` e `leading-*` já existem como escala.
- **Cada variante de botão declara a própria cor de borda.** Entre duas utilitárias de
  `border-color`, quem ganha é a que vem depois na folha de estilo, não no `className`.
- **A casca vem de `src/components/shell.tsx`**: `AgenciaShell` (menu lateral) para as telas
  da agência, `PortalShell` (barra no topo) para as do cliente. Página não monta `<main>` nem
  cabeçalho próprio. `/bio` escolhe uma ou outra pelo papel de quem entrou.
- **Toda rota exporta `metadata.title`** — o layout raiz aplica o template `%s · Momentum
  Hub`. Sem isso a aba do navegador não diz em que tela o usuário está.
- **O painel da agência lê `agencia_empresas()` e `agencia_acessos()`**, não monta a lista
  consulta a consulta. As duas são `security definer` e começam por `is_agency()` — sem essa
  linha seriam um jeito de qualquer sessão listar as empresas todas. `agencia_acessos()` lê
  `auth.users` e aposentou o `listUsers(1000)` da Admin API na tela.
- **Faturamento do mês é sempre `fat_mesa + fat_delivery + fat_ifood`**, nunca a coluna
  `fat_total`. Vale na RPC e no `dashboard-view.tsx` — as duas telas não podem discordar.
- **Filtro e busca ficam na URL** (`?q=`, `?filtro=`), por formulário GET: recarregar,
  voltar e mandar o link para alguém precisam dar no mesmo resultado.
- **Tabela vira lista no celular** (`hidden lg:block` + `lg:hidden`). Tabela que rola de lado
  esconde coluna e obriga a arrastar para descobrir o que existe.
- **`ConfirmarAcao` com `digite=` no que não tem volta** (apagar mês); sem `digite` quando a
  pergunta basta (remover produto da precificação).
- **O formulário de dar acesso não vira diálogo.** A senha sorteada aparece uma vez no
  resultado, e diálogo que fecha ao enviar levaria a senha junto.
- **Número entra e sai por `src/lib/numero.ts`** — a tela e a action usam a mesma leitura.
  `paraNumero` aceita `147.456,00`, `147456,00` e o americano `147,456.00` colado de
  planilha. Ponto seguido de exatamente três dígitos é milhar; qualquer outra quantidade é
  decimal (`12.50` são doze e cinquenta). O `Number(texto.replace(",", "."))` que estava na
  action devolvia NaN para qualquer valor com separador de milhar, e NaN virava campo vazio.
- **`fat_total` e ticket médio são calculados, não digitados.** O formulário soma
  salão + delivery + iFood e grava o resultado em `fat_total`, para a coluna deixar de
  discordar do que o dashboard mostra. Ticket é faturamento ÷ pedidos e nem existe como
  coluna.
- **`fat_proprio` ("Cardápio próprio") não é lido por tela nenhuma** — nem no dashboard do
  cliente, nem no painel. Continua sendo coletado; se um dia ninguém sentir falta, é
  candidato a sair.
- **A tabela de precificação não é um `<form>`.** Cada linha tem o diálogo de remover, que é
  um formulário, e formulário dentro de formulário é HTML inválido. Por isso `salvar.ts`
  expõe `salvarPrecificacao` como server action chamada direto do componente
  (`useTransition`), e não por `action={}`.
- **A chave da transmissão só aparece dentro de diálogo.** Era um campo aberto no meio da
  página, ao lado do seletor de arquivo, com o segredo do Instagram do cliente à mostra.
- **`Dialogo` fecha ao enviar, menos quando `fecharAoEnviar={false}`.** Envio demorado (subir
  vídeo) precisa da rodinha visível; fechar na hora parece que nada aconteceu.
- Diálogo dentro de diálogo funciona (`<dialog>` nativo empilha no top layer) e o Esc fecha
  só o de cima — verificado no navegador, é o caso de remover material.

## Base de reuso

Copiar padrões do `../Fila de Espera` (projeto mais maduro do workspace): clients
Supabase, `current_restaurant_id()` → vira `current_org_id()`, scripts
`scripts/verify-rls.mjs`, estrutura de migrations.

## Comandos

```bash
npm run dev      # local :3000
npm run build    # valida tipos — rodar antes de fechar qualquer fase
npm run lint
npm run verify   # Fases 1, 3, 4 e 6
npm run verify:fase1   # identidade, acesso dado pela agência, isolamento por RLS
npm run verify:fase3   # bio: RLS das 4 tabelas, clique, hash de IP, CAPI, host bio.
npm run verify:fase4   # fila: portal e agência leem 0 linhas, partner, FK, realtime
npm run verify:fase6   # dashboard/pricing/lives: cópia linha a linha, RLS, bucket privado
```

O `verify:fase2` foi apagado na Fase 6: ele testava a RPC do projeto antigo e o vazamento do
slug, e as duas coisas deixaram de existir. A checagem que sobreviveu (`?org=` só vale para
agência) mudou de casa para o `verify:fase6`.

Os verifies das Fases 3 e 6 precisam do app respondendo para as checagens de ponta a ponta —
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

## Quem cria a conta do cliente

**A agência.** Em `/agencia`, `criarAcessoCliente` cria o usuário pela Admin API (chave
secreta) e já grava o membership; a senha sorteada aparece **uma vez** na tela de quem criou
e não é guardada em lugar nenhum — por isso essa action devolve resultado em vez de
redirecionar (senha em querystring entra no histórico e no log de acesso).

O autocadastro **não existe**: a página `/cadastro` foi removida e o projeto está com
`disable_signup: true`. Até a Fase 6 era o contrário — a agência registrava um convite e o
acesso só nascia quando o cliente ia se cadastrar. O passo final ficava com quem menos tinha
motivo para dá-lo: a Villa passou oito dias com convite pendente e zero membro. Se aparecer a
vontade de reabrir cadastro público, é essa ideia voltando.

O primeiro usuário `agency` continua nascendo de SQL direto (`memberships` com papel
`agency`) — já feito para `luis_fossalussa@hotmail.com` na org `momentum-digital`.
