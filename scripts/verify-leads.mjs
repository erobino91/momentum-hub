/**
 * Verificação dos leads da LP — `lp_leads` e `lp_lead_eventos`.
 *
 * Três perguntas:
 *
 *   1. **O site anônimo só faz o que o form faz?** Insere nas colunas do form
 *      (com o `id` que vira o eventID do Pixel), não lê nada e não consegue
 *      gravar um lead já como "cliente" com valor.
 *   2. **Lead é assunto só da agência?** Cliente logado lê zero linha das duas
 *      tabelas; a agência lê e muda a situação.
 *   3. **O banco segura a regra do funil?** Situação fora das seis é recusada, e
 *      o mesmo evento não entra duas vezes para o mesmo lead — é o que impede
 *      duas vendas na Meta.
 *
 * Não manda nada para a Meta. Cria usuários e leads com marca própria e apaga
 * tudo no fim.
 *
 * Uso:  node scripts/verify-leads.mjs
 */

import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
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

const MARCA = `vl-${Date.now()}`;
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
      "User-Agent": "momentum-hub-verify",
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}

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
  return (await sql(`select id from auth.users where email = '${email}';`))[0].id;
}

async function entrar(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status}`);
  return (await r.json()).access_token;
}

/** Chamada ao PostgREST como `anon` (sem token) ou como o usuário do token. */
async function rest(token, metodo, caminho, corpo, prefer = "return=representation") {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    method: metodo,
    headers: {
      apikey: ANON,
      "Content-Type": "application/json",
      Prefer: prefer,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null;
  try {
    dados = JSON.parse(texto);
  } catch {
    dados = texto;
  }
  return { status: r.status, ok: r.ok, dados };
}

/** Sem linha nenhuma serve: array vazio, 401 ou 403 — o que não serve é dado. */
const nadaVeio = ({ status, dados }) =>
  status === 401 || status === 403 || (Array.isArray(dados) && dados.length === 0);

console.log(`\nVerificação dos leads da LP — projeto ${REF}\n`);

// O que vai para o hash da CAPI. Errar aqui não dá erro em lugar nenhum: o evento
// chega à Meta e não casa com ninguém. O Node 24 lê o `.ts` direto.
const regras = await import("../src/lib/leads.ts");
console.log("Regras de casamento com a Meta");
checar(regras.telefoneComPais("17991234567") === "5517991234567", "celular sem 55 ganha o 55");
checar(regras.telefoneComPais("1733334444") === "551733334444", "fixo sem 55 ganha o 55");
checar(regras.telefoneComPais("5517991234567") === "5517991234567", "quem digitou +55 não fica com 55 dobrado");
checar(regras.formatarTelefone("5517991234567") === "(17) 99123-4567", "telefone formatado tira o 55");
checar(regras.normalizarNome("  Mário José ") === "mario", "nome: primeiro, minúsculo e sem acento");
checar(regras.normalizarNome("ÂNGELA") === "angela", "nome: maiúsculo com acento");
console.log();

let orgCliente, orgAgencia, idCliente, idAgencia;
const idLead = randomUUID();

try {
  const orgs = await sql(`
    insert into public.orgs (name, slug) values
      ('Cliente ${MARCA}', '${MARCA}-cli'),
      ('Agência ${MARCA}', '${MARCA}-ag')
    returning id, slug;
  `);
  orgCliente = orgs.find((o) => o.slug.endsWith("-cli")).id;
  orgAgencia = orgs.find((o) => o.slug.endsWith("-ag")).id;
  idCliente = await cadastrar(`${MARCA}-cliente@exemplo-teste.com`);
  idAgencia = await cadastrar(`${MARCA}-agencia@exemplo-teste.com`);
  await sql(`
    insert into public.memberships (user_id, org_id, role) values
      ('${idCliente}'::uuid, '${orgCliente}'::uuid, 'owner'::public.membership_role),
      ('${idAgencia}'::uuid, '${orgAgencia}'::uuid, 'agency'::public.membership_role);
  `);
  const tokenCliente = await entrar(`${MARCA}-cliente@exemplo-teste.com`);
  const tokenAgencia = await entrar(`${MARCA}-agencia@exemplo-teste.com`);

  console.log("Site anônimo (anon key da LP)");
  // Igual ao form: sem `return=representation`, porque anon não lê.
  const insercao = await fetch(`${URL_BASE}/rest/v1/lp_leads`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      id: idLead,
      nome: `Teste ${MARCA}`,
      whatsapp: "17991234567",
      faturamento: "R$50k – R$70k/mês",
      fbp: "fb.1.1700000000000.123",
      fbc: "fb.1.1700000000000.abc",
    }),
  });
  checar(insercao.ok, "insere com id, fbp e fbc, como o form", `HTTP ${insercao.status}`);

  checar(nadaVeio(await rest(null, "GET", "lp_leads?select=id")), "não lê nenhum lead");

  const forcado = await rest(null, "POST", "lp_leads", {
    nome: `Forçado ${MARCA}`,
    whatsapp: "17990000000",
    faturamento: "x",
    status: "cliente",
    valor_mensal: 99999,
  }, "return=minimal"); // sem pedir a linha de volta: quem barra tem de ser o grant por coluna
  checar(!forcado.ok, "não grava lead já como cliente com valor", `HTTP ${forcado.status}`);

  checar(
    !(await rest(null, "POST", "lp_lead_eventos", { lead_id: idLead, evento: "Purchase" }, "return=minimal")).ok,
    "não grava evento",
  );

  console.log("\nCliente logado");
  checar(nadaVeio(await rest(tokenCliente, "GET", "lp_leads?select=id")), "lê 0 leads");
  checar(
    nadaVeio(await rest(tokenCliente, "GET", "lp_lead_eventos?select=id")),
    "lê 0 eventos",
  );

  console.log("\nAgência");
  const lido = await rest(tokenAgencia, "GET", `lp_leads?id=eq.${idLead}&select=status,fbp`);
  checar(
    lido.ok && lido.dados[0]?.status === "novo" && lido.dados[0]?.fbp,
    "lê o lead, que nasce como 'novo' e com o fbp do form",
  );

  const mudou = await rest(tokenAgencia, "PATCH", `lp_leads?id=eq.${idLead}`, {
    status: "cliente",
    valor_mensal: 2500,
  });
  checar(mudou.ok && mudou.dados[0]?.status === "cliente", "muda para cliente com valor");

  const invalido = await rest(tokenAgencia, "PATCH", `lp_leads?id=eq.${idLead}`, {
    status: "fechado",
  });
  checar(!invalido.ok, "situação fora das seis é recusada", `HTTP ${invalido.status}`);

  const primeiro = await rest(tokenAgencia, "POST", "lp_lead_eventos", {
    lead_id: idLead,
    evento: "Purchase",
    valor: 2500,
  });
  checar(primeiro.ok, "registra a venda");
  const segundo = await rest(tokenAgencia, "POST", "lp_lead_eventos", {
    lead_id: idLead,
    evento: "Purchase",
    valor: 3000,
  });
  checar(!segundo.ok, "a mesma venda não entra duas vezes", `HTTP ${segundo.status}`);
} catch (e) {
  console.error(`\nErro na montagem: ${e.message}`);
  falhas++;
} finally {
  await sql(`delete from public.lp_leads where id = '${idLead}' or nome like '%${MARCA}';`);
  for (const id of [orgCliente, orgAgencia]) {
    if (id) await sql(`delete from public.orgs where id = '${id}';`);
  }
  for (const id of [idCliente, idAgencia]) {
    if (id) {
      await sql(`delete from public.memberships where user_id = '${id}';`);
      await sql(`delete from auth.users where id = '${id}';`);
    }
  }
}

console.log(falhas ? `\n${falhas} falha(s).\n` : "\nTudo certo.\n");
process.exit(falhas ? 1 : 0);
