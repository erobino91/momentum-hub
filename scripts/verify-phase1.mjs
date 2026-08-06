/**
 * Verificação da Fase 1 — identidade, entitlements e isolamento por RLS.
 *
 * Cria duas empresas de teste com usuários distintos e confere, do lado de fora
 * do app (REST direto, como um cliente curioso faria), que:
 *   - cada usuário só enxerga a própria org;
 *   - cliente não escreve em orgs/entitlements;
 *   - o convite vira membership sozinho no cadastro;
 *   - papel `agency` enxerga tudo.
 * No fim apaga tudo que criou.
 *
 * Uso:  node scripts/verify-phase1.mjs
 * Lê `.env.local` (URL + anon key) e `.supabase-token.txt` (API de gestão,
 * usada só para o bootstrap da agência, confirmar emails e limpar).
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
const TOKEN_GESTAO = readFileSync(join(raiz, ".supabase-token.txt"), "utf8").trim();
const REF = new globalThis.URL(URL_BASE).hostname.split(".")[0];

const MARCA = `vp1-${Date.now()}`;
const emailA = `${MARCA}-a@exemplo-teste.com`;
const emailB = `${MARCA}-b@exemplo-teste.com`;
const emailAg = `${MARCA}-agencia@exemplo-teste.com`;
const SENHA = "SenhaDeTeste123";

let falhas = 0;
function checar(ok, descricao, detalhe = "") {
  console.log(`${ok ? "  ok  " : "  FALHA"} ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
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

/**
 * Cria o usuário direto no `auth.users` em vez de chamar /auth/v1/signup: o
 * endpoint recusa domínios de teste ("email_address_invalid") e usar um domínio
 * real dispararia email de confirmação para caixa inexistente. O trigger de
 * convite é `after insert on auth.users`, então continua sendo exercitado.
 */
async function cadastrar(email) {
  await sql(`
    with novo as (
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        -- O GoTrue lê estas colunas como texto puro; com null o login quebra
        -- em "Database error querying schema".
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

async function entrar(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${await r.text()}`);
  return (await r.json()).access_token;
}

function rest(token) {
  return async (caminho, init = {}) => {
    const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
      ...init,
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
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

async function limpar() {
  await sql(`
    delete from auth.users where email like '${MARCA}-%';
    delete from public.orgs where slug like '${MARCA}-%';
  `);
}

async function main() {
  console.log(`Projeto ${REF} — marca de teste ${MARCA}\n`);

  // --- preparo: duas orgs, convites e usuários -----------------------------
  const [orgs] = [
    await sql(`
      insert into public.orgs (name, slug) values
        ('Empresa A ${MARCA}', '${MARCA}-a'),
        ('Empresa B ${MARCA}', '${MARCA}-b')
      returning id, slug;
    `),
  ];
  const orgA = orgs.find((o) => o.slug.endsWith("-a")).id;
  const orgB = orgs.find((o) => o.slug.endsWith("-b")).id;

  await sql(`
    insert into public.entitlements (org_id, module, enabled) values
      ('${orgA}', 'dashboard', true),
      ('${orgA}', 'bio', false),
      ('${orgB}', 'dashboard', true);
    insert into public.invites (email, org_id, role) values
      ('${emailA}', '${orgA}', 'owner'),
      ('${emailB}', '${orgB}', 'owner'),
      ('${emailAg}', '${orgA}', 'agency');
  `);

  for (const e of [emailA, emailB, emailAg]) await cadastrar(e);

  console.log("Convite vira acesso");
  const vinculos = await sql(`
    select u.email, m.org_id, m.role
    from auth.users u join public.memberships m on m.user_id = u.id
    where u.email like '${MARCA}-%' order by u.email;
  `);
  checar(vinculos.length === 3, "cadastro criou os 3 memberships", `vieram ${vinculos.length}`);
  checar(
    vinculos.find((v) => v.email === emailA)?.org_id === orgA,
    "usuário A ficou na empresa A",
  );
  const pendentes = await sql(
    `select count(*)::int as n from public.invites where email like '${MARCA}-%' and accepted_at is null;`,
  );
  checar(pendentes[0].n === 0, "convites marcados como aceitos");

  // --- isolamento ----------------------------------------------------------
  console.log("\nIsolamento entre empresas");
  const A = rest(await entrar(emailA));

  const vistas = await A("orgs?select=id,slug");
  checar(vistas.status === 200, "A consegue ler orgs", `HTTP ${vistas.status}`);
  checar(
    Array.isArray(vistas.corpo) && vistas.corpo.length === 1 && vistas.corpo[0].id === orgA,
    "A enxerga só a própria empresa",
    `veio ${JSON.stringify(vistas.corpo)}`,
  );

  const alvoB = await A(`orgs?select=id&id=eq.${orgB}`);
  checar(
    Array.isArray(alvoB.corpo) && alvoB.corpo.length === 0,
    "pedir a empresa B pelo id devolve vazio (não erro)",
    `HTTP ${alvoB.status} ${JSON.stringify(alvoB.corpo)}`,
  );

  const entsA = await A("entitlements?select=module,org_id");
  checar(
    Array.isArray(entsA.corpo) && entsA.corpo.every((e) => e.org_id === orgA),
    "A só vê entitlements da própria empresa",
    `veio ${JSON.stringify(entsA.corpo)}`,
  );

  const membsA = await A("memberships?select=org_id");
  checar(
    Array.isArray(membsA.corpo) && membsA.corpo.every((m) => m.org_id === orgA),
    "A só vê memberships da própria empresa",
  );

  // --- escrita bloqueada ---------------------------------------------------
  console.log("\nCliente não escreve");
  const tentaCriar = await A("orgs", {
    method: "POST",
    body: JSON.stringify({ name: "Invadida", slug: `${MARCA}-x` }),
  });
  checar(tentaCriar.status === 401 || tentaCriar.status === 403, "A não cria org", `HTTP ${tentaCriar.status}`);

  const tentaLigar = await A(`entitlements?org_id=eq.${orgA}&module=eq.bio`, {
    method: "PATCH",
    body: JSON.stringify({ enabled: true }),
  });
  const bioDepois = await sql(
    `select enabled from public.entitlements where org_id = '${orgA}' and module = 'bio';`,
  );
  checar(
    bioDepois[0].enabled === false,
    "A não liga módulo para si mesmo",
    `HTTP ${tentaLigar.status}, enabled=${bioDepois[0].enabled}`,
  );

  const tentaConvite = await A("invites?select=email");
  checar(
    Array.isArray(tentaConvite.corpo) && tentaConvite.corpo.length === 0,
    "A não lê a tabela de convites",
    `HTTP ${tentaConvite.status}`,
  );

  // --- agência vê tudo -----------------------------------------------------
  console.log("\nPapel agency");
  const Ag = rest(await entrar(emailAg));
  const orgsAg = await Ag("orgs?select=id&or=(id.eq." + orgA + ",id.eq." + orgB + ")");
  checar(
    Array.isArray(orgsAg.corpo) && orgsAg.corpo.length === 2,
    "agência enxerga as duas empresas",
    `veio ${JSON.stringify(orgsAg.corpo)}`,
  );

  const ligaBio = await Ag(`entitlements?org_id=eq.${orgA}&module=eq.bio`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ enabled: true }),
  });
  checar(
    ligaBio.status === 200 && ligaBio.corpo?.[0]?.enabled === true,
    "agência liga módulo",
    `HTTP ${ligaBio.status}`,
  );

  console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} verificação(ões) falharam.`);
}

try {
  await main();
} catch (e) {
  console.error("\nErro na execução:", e.message);
  falhas++;
} finally {
  await limpar();
  console.log("Dados de teste removidos.");
}

process.exit(falhas === 0 ? 0 : 1);
