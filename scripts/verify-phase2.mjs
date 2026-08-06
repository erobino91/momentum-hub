/**
 * Verificação da Fase 2 — dashboard embutido.
 *
 * O que precisa ser verdade:
 *   - a RPC `get_public_dashboard` do projeto antigo responde com a chave do
 *     `.env.local`, e a leitura direta das tabelas continua negada ao anon;
 *   - o slug do dashboard antigo (guardado em `entitlements.config`) não vaza:
 *     nem por RLS para outra empresa, nem no HTML/RSC que o navegador recebe;
 *   - sem `enabled = true` o portal não busca nada;
 *   - `?org=` só funciona para papel `agency`.
 *
 * Uso:  node scripts/verify-phase2.mjs [slug-de-teste]
 *
 * As checagens de ponta a ponta precisam do app no ar. Aponte com HUB_URL
 * (padrão http://localhost:3000); se não responder, elas são puladas e o script
 * avisa — nada é dado como aprovado sem ter rodado.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DASH_URL = env.DASHBOARD_SUPABASE_URL;
const DASH_ANON = env.DASHBOARD_SUPABASE_ANON_KEY;
const TOKEN_GESTAO = readFileSync(join(raiz, ".supabase-token.txt"), "utf8").trim();
const REF = new globalThis.URL(URL_BASE).hostname.split(".")[0];
const HUB_URL = (process.env.HUB_URL ?? "http://localhost:3000").replace(/\/$/, "");

const SLUG = process.argv[2] ?? "villa-burguer";
const MARCA = `vp2-${Date.now()}`;
const emailA = `${MARCA}-a@exemplo-teste.com`;
const emailB = `${MARCA}-b@exemplo-teste.com`;
const emailAg = `${MARCA}-agencia@exemplo-teste.com`;
const SENHA = "SenhaDeTeste123";

let falhas = 0;
let pulados = 0;

function checar(ok, descricao, detalhe = "") {
  console.log(`${ok ? "  ok  " : "  FALHA"} ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

function pular(descricao, motivo) {
  console.log(`  --    ${descricao} — pulado: ${motivo}`);
  pulados++;
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN_GESTAO}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Mesmo caminho da Fase 1: o /signup recusa domínio de teste. */
async function cadastrar(email) {
  await sql(`
    with novo as (
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        'authenticated', 'authenticated', '${email}',
        extensions.crypt('${SENHA}', extensions.gen_salt('bf')),
        now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        '', '', '', '', '', '', '', ''
      ) returning id, email
    )
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    select id::text, id,
           jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
           'email', now(), now(), now()
    from novo;
  `);
}

async function sessao(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${await r.text()}`);
  return r.json();
}

/**
 * Monta o cookie que o `@supabase/ssr` espera: JSON da sessão sob
 * `sb-<ref>-auth-token`, partido em `.0`, `.1`... quando passa de 3180 bytes
 * (mesmo limite do `createChunks` da lib).
 */
function cookieDaSessao(s) {
  const chave = `sb-${REF}-auth-token`;
  const valor = JSON.stringify(s);
  const codificado = encodeURIComponent(valor);

  if (codificado.length <= 3180) return `${chave}=${codificado}`;

  const partes = [];
  let resto = codificado;
  while (resto.length > 0) {
    let cabeca = resto.slice(0, 3180);
    const ultimoEscape = cabeca.lastIndexOf("%");
    if (ultimoEscape > 3180 - 3) cabeca = cabeca.slice(0, ultimoEscape);
    partes.push(cabeca);
    resto = resto.slice(cabeca.length);
  }
  return partes.map((p, i) => `${chave}.${i}=${p}`).join("; ");
}

async function abrir(caminho, cookie) {
  const r = await fetch(`${HUB_URL}${caminho}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
  return { status: r.status, html: await r.text() };
}

function restCom(token) {
  return async (caminho) => {
    const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
    const texto = await r.text();
    let corpo = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      corpo = texto;
    }
    return { status: r.status, corpo };
  };
}

/* ── as fórmulas do dash.html, reescritas aqui de propósito ───────────────
   Se o portal mudar um cálculo sem querer, é aqui que a diferença aparece. */

const brl = (v) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const inteiro = (v) => Math.round(Number(v) || 0).toLocaleString("pt-BR");
const dividir = (a, b) => (Number(b) > 0 ? Number(a) / Number(b) : 0);
const roas = (v) => (v > 0 ? `${v.toFixed(1).replace(".", ",")}x` : "—");

/** Valores que o dash.html mostraria para o mês mais recente. */
function numerosDoDash(p) {
  const total =
    (Number(p.fat_mesa) || 0) +
    (Number(p.fat_delivery) || 0) +
    (Number(p.fat_ifood) || 0);

  return {
    "faturamento total": brl(total),
    "faturamento mesa": brl(p.fat_mesa),
    "pedidos mesa": inteiro(p.pedidos_mesa),
    "ticket médio mesa": brl(dividir(p.fat_mesa, p.pedidos_mesa)),
    "faturamento delivery": brl(p.fat_delivery),
    "pedidos delivery": inteiro(p.pedidos_delivery),
    "ticket médio delivery": brl(dividir(p.fat_delivery, p.pedidos_delivery)),
    "faturamento ifood": brl(p.fat_ifood),
    "pedidos ifood": inteiro(p.if_concluidos),
    "ticket médio ifood": brl(dividir(p.fat_ifood, p.if_concluidos)),
    "meta investido": brl(p.meta_invest),
    "meta vendas": brl(p.meta_vendas),
    "meta roas": roas(dividir(p.meta_vendas, p.meta_invest)),
    "google investido": brl(p.google_invest),
    "google vendas": brl(p.google_vendas),
    "google roas": roas(dividir(p.google_vendas, p.google_invest)),
    "google visitas à loja": inteiro(p.google_visitas_loja),
    "google rotas": inteiro(p.google_rotas),
    "crm investido": brl(p.crm_invest),
    "crm vendas": brl(p.crm_vendas),
    "crm roas": roas(dividir(p.crm_vendas, p.crm_invest)),
    "funil próprio — visitas": inteiro(p.cp_visitas),
    "funil próprio — concluídos": inteiro(p.cp_concluidos),
    "funil ifood — visitas": inteiro(p.if_visitas),
  };
}

async function limpar() {
  await sql(`
    delete from auth.users where email like '${MARCA}-%';
    delete from public.orgs where slug like '${MARCA}-%';
  `);
}

async function main() {
  console.log(`Projeto ${REF} — marca ${MARCA} — slug de teste "${SLUG}"\n`);

  // --- 1. projeto antigo ----------------------------------------------------
  console.log("Projeto antigo do dashboard");
  const rpc = await fetch(`${DASH_URL}/rest/v1/rpc/get_public_dashboard`, {
    method: "POST",
    headers: {
      apikey: DASH_ANON,
      Authorization: `Bearer ${DASH_ANON}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_slug: SLUG }),
  });
  const dados = rpc.ok ? await rpc.json() : null;
  checar(rpc.status === 200, "RPC get_public_dashboard responde", `status ${rpc.status}`);
  checar(!!dados?.client?.name, "RPC devolve o cliente do slug de teste");
  checar(
    Array.isArray(dados?.periods) && dados.periods.length > 0,
    "RPC devolve períodos",
    `${dados?.periods?.length ?? 0} meses`,
  );

  for (const tabela of ["clients", "periods"]) {
    const r = await fetch(`${DASH_URL}/rest/v1/${tabela}?select=id&limit=1`, {
      headers: { apikey: DASH_ANON, Authorization: `Bearer ${DASH_ANON}` },
    });
    const corpo = await r.text();
    const negado = r.status >= 400 || corpo.trim() === "[]";
    checar(negado, `anon não lê ${tabela} direto`, `status ${r.status}`);
  }

  // --- preparo no hub -------------------------------------------------------
  const orgs = await sql(`
    insert into public.orgs (name, slug) values
      ('Empresa A ${MARCA}', '${MARCA}-a'),
      ('Empresa B ${MARCA}', '${MARCA}-b')
    returning id, slug;
  `);
  const orgA = orgs.find((o) => o.slug.endsWith("-a")).id;
  const orgB = orgs.find((o) => o.slug.endsWith("-b")).id;

  await sql(`
    insert into public.entitlements (org_id, module, enabled, config) values
      ('${orgA}', 'dashboard', true,  '{"dashboard_slug":"${SLUG}"}'::jsonb),
      ('${orgB}', 'dashboard', false, '{"dashboard_slug":"${SLUG}"}'::jsonb);
    insert into public.invites (email, org_id, role) values
      ('${emailA}',  '${orgA}', 'owner'),
      ('${emailB}',  '${orgB}', 'owner'),
      ('${emailAg}', '${orgB}', 'agency');
  `);
  for (const e of [emailA, emailB, emailAg]) await cadastrar(e);

  const sA = await sessao(emailA);
  const sB = await sessao(emailB);
  const sAg = await sessao(emailAg);

  // --- 2. o slug não atravessa a RLS ---------------------------------------
  console.log("\nIsolamento do slug");
  const comoB = restCom(sB.access_token);
  const alheio = await comoB(`entitlements?select=config&org_id=eq.${orgA}`);
  checar(
    Array.isArray(alheio.corpo) && alheio.corpo.length === 0,
    "empresa B não lê a config da empresa A",
    `vieram ${Array.isArray(alheio.corpo) ? alheio.corpo.length : "?"} linhas`,
  );
  const proprio = await comoB(`entitlements?select=config&org_id=eq.${orgB}`);
  checar(
    JSON.stringify(proprio.corpo ?? "").includes(SLUG),
    "empresa B continua lendo a própria config",
  );

  // --- 3. ponta a ponta no app ---------------------------------------------
  console.log("\nPortal");
  let noAr = false;
  try {
    const r = await fetch(`${HUB_URL}/api/health`);
    noAr = r.ok;
  } catch {
    noAr = false;
  }

  if (!noAr) {
    for (const d of [
      "dashboard do cliente A carrega os números",
      "o slug não aparece no HTML entregue",
      "cliente B (módulo desligado) não recebe dados",
      "?org= é ignorado para quem não é agência",
      "?org= funciona para papel agency",
      "números idênticos aos do dash.html",
    ])
      pular(d, `${HUB_URL} não respondeu em /api/health`);
  } else {
    const paginaA = await abrir("/dashboard", cookieDaSessao(sA));
    checar(paginaA.status === 200, "dashboard do cliente A responde 200", `status ${paginaA.status}`);
    checar(
      paginaA.html.includes(dados?.client?.name ?? " "),
      "dashboard do cliente A carrega os números",
      `nome do cliente ${paginaA.html.includes(dados?.client?.name) ? "presente" : "ausente"}`,
    );
    checar(
      !paginaA.html.includes(SLUG),
      "o slug não aparece no HTML entregue",
      paginaA.html.includes(SLUG) ? "VAZOU" : "",
    );

    // O portal abre no mês mais recente, que é o último da RPC.
    const esperados = numerosDoDash(dados.periods[dados.periods.length - 1]);
    const divergentes = Object.entries(esperados).filter(
      ([, valor]) => !paginaA.html.includes(valor),
    );
    checar(
      divergentes.length === 0,
      "números idênticos aos do dash.html",
      divergentes.length
        ? divergentes.map(([nome, valor]) => `${nome} (${valor})`).join(", ")
        : `${Object.keys(esperados).length} valores conferidos`,
    );

    const paginaB = await abrir("/dashboard", cookieDaSessao(sB));
    checar(
      !paginaB.html.includes(dados?.client?.name ?? " ") &&
        paginaB.html.includes("não está liberado"),
      "cliente B (módulo desligado) não recebe dados",
    );

    const paginaBespiando = await abrir(`/dashboard?org=${orgA}`, cookieDaSessao(sB));
    checar(
      !paginaBespiando.html.includes(dados?.client?.name ?? " "),
      "?org= é ignorado para quem não é agência",
    );

    const paginaAgencia = await abrir(`/dashboard?org=${orgA}`, cookieDaSessao(sAg));
    checar(
      paginaAgencia.html.includes(dados?.client?.name ?? " "),
      "?org= funciona para papel agency",
    );
    checar(
      !paginaAgencia.html.includes(SLUG),
      "nem na visão da agência o slug aparece no HTML",
    );
  }
}

try {
  await main();
} catch (e) {
  console.error("\nErro na verificação:", e.message);
  falhas++;
} finally {
  await limpar().catch((e) => console.error("Falha ao limpar:", e.message));
}

console.log(
  `\n${falhas === 0 ? "Tudo certo" : `${falhas} falha(s)`}` +
    (pulados ? ` · ${pulados} checagem(ns) pulada(s)` : ""),
);
process.exit(falhas === 0 ? 0 : 1);
