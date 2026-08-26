/**
 * Verificação da Fase 9 — o financeiro da agência.
 *
 * Três perguntas:
 *
 *   1. **O dinheiro do cliente é assunto da agência?** As três tabelas têm
 *      policy `is_agency()` sem ramo de org: `anon` e cliente logado leem
 *      **zero** linha, e a RPC de geração recusa quem não é agência.
 *   2. **O passado fica quieto quando o presente muda?** Reajustar em julho não
 *      pode mexer no valor da cobrança de junho, e pausar um contrato não pode
 *      sumir com as cobranças que já existiam.
 *   3. **As bordas de calendário estão certas?** Dia 31 em fevereiro, e gerar o
 *      mesmo mês duas vezes sem duplicar nem sobrescrever.
 *
 * Cria empresas e usuários com marca própria e apaga tudo no fim.
 *
 * Uso:  node scripts/verify-phase9.mjs
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

const MARCA = `vp9-${Date.now()}`;
const SENHA = "SenhaDeTeste123";
const emails = {
  cliente: `${MARCA}-cliente@exemplo-teste.com`,
  agencia: `${MARCA}-agencia@exemplo-teste.com`,
};

const TABELAS = ["billing_contracts", "billing_values", "billing_charges"];

let falhas = 0;
function checar(ok, descricao, detalhe = "") {
  console.log(`${ok ? "  ok  " : "  FALHA"} ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN_GESTAO}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Roda SQL esperando que ele falhe; devolve a mensagem do banco. */
async function sqlDeveFalhar(query) {
  try {
    await sql(query);
    return null;
  } catch (e) {
    return String(e.message ?? e);
  }
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

function rest(token) {
  return async (caminho) => {
    const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
      headers: {
        apikey: ANON,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const texto = await r.text();
    let corpo = null;
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }
    return { status: r.status, corpo };
  };
}

function rpc(token) {
  return async (nome, args) => {
    const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
      method: "POST",
      headers: {
        apikey: ANON,
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(args),
    });
    const texto = await r.text();
    let corpo = null;
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }
    return { status: r.status, corpo };
  };
}

/** Sem linha nenhuma serve: array vazio, 401 ou 403 — o que não serve é dado. */
function nadaVeio({ status, corpo }) {
  if (status === 401 || status === 403) return true;
  return Array.isArray(corpo) && corpo.length === 0;
}

console.log(`\nVerificação da Fase 9 — projeto ${REF}\n`);

let orgA, orgB, orgC;
let idCliente, idAgencia;

try {
  // ── montagem ──────────────────────────────────────────────────────────────
  // A: ativo, vence dia 31 (a borda de calendário), reajustado em julho.
  // B: pausado, vence dia 10.
  // C: nenhuma linha de contrato — é a empresa que a tela precisa continuar
  //    mostrando para alguém lembrar de cadastrar.
  const orgs = await sql(`
    insert into public.orgs (name, slug) values
      ('Empresa A ${MARCA}', '${MARCA}-a'),
      ('Empresa B ${MARCA}', '${MARCA}-b'),
      ('Empresa C ${MARCA}', '${MARCA}-c')
    returning id, slug;
  `);
  orgA = orgs.find((o) => o.slug.endsWith("-a")).id;
  orgB = orgs.find((o) => o.slug.endsWith("-b")).id;
  orgC = orgs.find((o) => o.slug.endsWith("-c")).id;

  const contratos = await sql(`
    insert into public.billing_contracts (org_id, situacao, dia_vencimento, forma_pagamento, cliente_desde)
    values
      ('${orgA}', 'ativo',   31, 'pix',    '2026-06-01'),
      ('${orgB}', 'pausado', 10, 'boleto', '2026-06-01')
    returning id, org_id;
  `);
  const contratoA = contratos.find((c) => c.org_id === orgA).id;
  const contratoB = contratos.find((c) => c.org_id === orgB).id;

  await sql(`
    insert into public.billing_values (contract_id, valor, vigente_desde) values
      ('${contratoA}', 1200.00, '2026-06-01'),
      ('${contratoA}', 1500.00, '2026-07-01'),
      ('${contratoB}',  900.00, '2026-06-01');
  `);

  idCliente = await cadastrar(emails.cliente);
  idAgencia = await cadastrar(emails.agencia);
  await sql(`
    insert into public.memberships (user_id, org_id, role) values
      ('${idCliente}'::uuid, '${orgA}'::uuid, 'owner'::public.membership_role),
      ('${idAgencia}'::uuid, '${orgA}'::uuid, 'agency'::public.membership_role);
  `);

  const Anon = rest(null);
  const Cli = rest(await entrar(emails.cliente));
  const tokenAgencia = await entrar(emails.agencia);
  const Ag = rest(tokenAgencia);
  const rpcCli = rpc(await entrar(emails.cliente));
  const rpcAg = rpc(tokenAgencia);

  // ── 1. Isto é da agência ─────────────────────────────────────────────────
  console.log("O financeiro é da agência");

  for (const tabela of TABELAS) {
    checar(nadaVeio(await Anon(`${tabela}?select=id`)), `anon lê 0 linhas de ${tabela}`);
  }
  for (const tabela of TABELAS) {
    const r = await Cli(`${tabela}?select=id`);
    checar(nadaVeio(r), `cliente logado lê 0 linhas de ${tabela}`, `HTTP ${r.status}`);
  }

  // O dono da empresa A é dono do contrato — e mesmo assim não o enxerga. É o
  // ponto: a mensalidade é uma conversa entre a agência e ele, não uma tela do
  // portal. Se um dia isso mudar, muda por decisão, não por policy frouxa.
  const policies = await sql(`
    select tablename, qual::text as usando from pg_policies
    where schemaname = 'public' and tablename in ('billing_contracts','billing_values','billing_charges');
  `);
  checar(policies.length === 3, "uma policy por tabela", `${policies.length} policies`);
  checar(
    policies.every((p) => p.usando && p.usando.includes("is_agency") && !p.usando.includes("current_org_id")),
    "nenhuma policy tem ramo de org — só is_agency()",
  );

  const rCliRpc = await rpcCli("agencia_financeiro", { p_mes: "2026-06-01" });
  checar(
    !Array.isArray(rCliRpc.corpo) || rCliRpc.corpo.length === 0,
    "cliente chamando agencia_financeiro recebe 0 linhas",
    `HTTP ${rCliRpc.status}`,
  );

  const rCliGerar = await rpcCli("gerar_cobrancas", { p_mes: "2026-06-01" });
  checar(rCliGerar.status >= 400, "cliente chamando gerar_cobrancas falha alto", `HTTP ${rCliGerar.status}`);

  // ── 2. Bordas de calendário ──────────────────────────────────────────────
  console.log("\nO dia do vencimento");

  const datas = await sql(`
    select
      public.vencimento_do_mes(31, '2026-02-01') as fev31,
      public.vencimento_do_mes(31, '2026-08-01') as ago31,
      public.vencimento_do_mes(10, '2026-08-01') as ago10,
      public.vencimento_do_mes(31, '2028-02-01') as bissexto;
  `);
  const d = datas[0];
  checar(d.fev31 === "2026-02-28", "dia 31 em fevereiro vira 28", String(d.fev31));
  checar(d.bissexto === "2028-02-29", "dia 31 em fevereiro bissexto vira 29", String(d.bissexto));
  checar(d.ago31 === "2026-08-31", "dia 31 em agosto continua 31", String(d.ago31));
  checar(d.ago10 === "2026-08-10", "dia 10 é dia 10", String(d.ago10));

  // ── 3. O valor vigente ───────────────────────────────────────────────────
  console.log("\nO valor vigente é o da época");

  const valores = await sql(`
    select
      public.mensalidade_vigente('${contratoA}', '2026-06-30') as junho,
      public.mensalidade_vigente('${contratoA}', '2026-07-31') as julho,
      public.mensalidade_vigente('${contratoA}', '2026-05-31') as antes;
  `);
  const v = valores[0];
  checar(Number(v.junho) === 1200, "junho vale 1200 (antes do reajuste)", String(v.junho));
  checar(Number(v.julho) === 1500, "julho vale 1500 (depois do reajuste)", String(v.julho));
  checar(v.antes === null, "antes da primeira vigência não há valor", String(v.antes));

  // ── 4. Geração das cobranças ─────────────────────────────────────────────
  console.log("\nGerar o mês");

  const g1 = await rpcAg("gerar_cobrancas", { p_mes: "2026-06-01" });
  checar(g1.status === 200 && g1.corpo === 1, "junho gera 1 cobrança (só o contrato ativo)", `${g1.corpo}`);

  const junho = await sql(`
    select org_id, vencimento::text, valor, status from public.billing_charges
    where competencia = '2026-06-01' and org_id in ('${orgA}','${orgB}','${orgC}');
  `);
  checar(junho.length === 1 && junho[0].org_id === orgA, "só a empresa ativa foi cobrada");
  checar(junho[0]?.vencimento === "2026-06-30", "vencimento cortado no fim de junho", String(junho[0]?.vencimento));
  checar(Number(junho[0]?.valor) === 1200, "valor congelado no preço de junho", String(junho[0]?.valor));
  checar(junho[0]?.status === "pendente", "cobrança nasce pendente");

  const g2 = await rpcAg("gerar_cobrancas", { p_mes: "2026-06-01" });
  checar(g2.corpo === 0, "gerar junho de novo não cria nada", `${g2.corpo}`);

  // Marca como paga e gera de novo: o mês fechado não pode ser reaberto por um
  // clique distraído no botão de gerar.
  await sql(`
    update public.billing_charges set status = 'pago', pago_em = '2026-06-28'
    where competencia = '2026-06-01' and org_id = '${orgA}';
  `);
  await rpcAg("gerar_cobrancas", { p_mes: "2026-06-01" });
  const depois = await sql(`
    select status, pago_em::text, valor from public.billing_charges
    where competencia = '2026-06-01' and org_id = '${orgA}';
  `);
  checar(depois[0]?.status === "pago", "gerar de novo não desfaz o pagamento");
  checar(Number(depois[0]?.valor) === 1200, "gerar de novo não reescreve o valor");

  // Julho: reajuste já valendo.
  await rpcAg("gerar_cobrancas", { p_mes: "2026-07-01" });
  const julho = await sql(`
    select valor, vencimento::text from public.billing_charges
    where competencia = '2026-07-01' and org_id = '${orgA}';
  `);
  checar(Number(julho[0]?.valor) === 1500, "julho já nasce com o valor reajustado", String(julho[0]?.valor));
  const junhoAindaVale = await sql(`
    select valor from public.billing_charges where competencia = '2026-06-01' and org_id = '${orgA}';
  `);
  checar(Number(junhoAindaVale[0]?.valor) === 1200, "e junho continua valendo 1200");

  // ── 5. Contrato pausado ──────────────────────────────────────────────────
  console.log("\nPausar não apaga o passado");

  await sql(`update public.billing_contracts set situacao = 'ativo' where id = '${contratoB}';`);
  await rpcAg("gerar_cobrancas", { p_mes: "2026-07-01" });
  const bJulho = await sql(`
    select count(*)::int as n from public.billing_charges
    where competencia = '2026-07-01' and org_id = '${orgB}';
  `);
  checar(bJulho[0].n === 1, "empresa reativada passa a ser cobrada");

  await sql(`update public.billing_contracts set situacao = 'pausado' where id = '${contratoB}';`);
  await rpcAg("gerar_cobrancas", { p_mes: "2026-08-01" });
  const bAgosto = await sql(`
    select
      (select count(*)::int from public.billing_charges where competencia = '2026-08-01' and org_id = '${orgB}') as agosto,
      (select count(*)::int from public.billing_charges where competencia = '2026-07-01' and org_id = '${orgB}') as julho;
  `);
  checar(bAgosto[0].agosto === 0, "empresa pausada não gera cobrança nova");
  checar(bAgosto[0].julho === 1, "e a cobrança que já existia continua de pé");

  // ── 6. "Atrasado" não é um estado gravado ────────────────────────────────
  console.log("\nAtrasado é derivado, não gravado");

  const recusaAtrasado = await sqlDeveFalhar(`
    update public.billing_charges set status = 'atrasado'
    where competencia = '2026-07-01' and org_id = '${orgA}';
  `);
  checar(!!recusaAtrasado, "o banco recusa status 'atrasado'");

  const recusaPagoSemData = await sqlDeveFalhar(`
    update public.billing_charges set status = 'pago', pago_em = null
    where competencia = '2026-07-01' and org_id = '${orgA}';
  `);
  checar(!!recusaPagoSemData, "o banco recusa pago sem data de pagamento");

  // Vencida ontem e ninguém tocou: continua `pendente` no banco. É a tela que
  // chama isso de atrasado, e é por isso que ela nunca fica desatualizada.
  await sql(`
    update public.billing_charges set vencimento = current_date - 1
    where competencia = '2026-07-01' and org_id = '${orgA}';
  `);
  const vencida = await sql(`
    select status from public.billing_charges where competencia = '2026-07-01' and org_id = '${orgA}';
  `);
  checar(vencida[0]?.status === "pendente", "cobrança vencida ontem continua 'pendente' no banco");

  const recusaValorRepetido = await sqlDeveFalhar(`
    insert into public.billing_values (contract_id, valor, vigente_desde)
    values ('${contratoA}', 1600, '2026-07-01');
  `);
  checar(!!recusaValorRepetido, "dois valores com a mesma vigência são recusados");

  // ── 7. A tela em uma consulta ────────────────────────────────────────────
  console.log("\nA consulta que monta a tela");

  const rTela = await rpcAg("agencia_financeiro", { p_mes: "2026-06-01" });
  const linhas = Array.isArray(rTela.corpo) ? rTela.corpo : [];
  const lA = linhas.find((l) => l.org_id === orgA);
  const lC = linhas.find((l) => l.org_id === orgC);

  checar(linhas.length > 0, "a agência recebe linhas", `${linhas.length}`);
  checar(!!lC && lC.contrato_id === null, "empresa sem contrato aparece na lista, com nulos");
  checar(Number(lA?.valor_vigente) === 1200, "valor vigente é o do mês consultado, não o de hoje", String(lA?.valor_vigente));
  checar(lA?.status === "pago" && lA?.valor !== null, "a cobrança do mês vem junto na mesma linha");
  checar(lA?.forma_pagamento === "pix" && lA?.dia_vencimento === 31, "os dados do contrato vêm junto");
} finally {
  // ── limpeza ───────────────────────────────────────────────────────────────
  // `on delete cascade` leva contrato, valores e cobranças junto com a org.
  for (const id of [orgA, orgB, orgC]) {
    if (id) await sql(`delete from public.orgs where id = '${id}';`);
  }
  for (const id of [idCliente, idAgencia]) {
    if (id) {
      await sql(`delete from public.memberships where user_id = '${id}';`);
      await sql(`delete from auth.users where id = '${id}';`);
    }
  }
  console.log("\nDados de teste removidos.");
}

console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo verde"}\n`);
process.exit(falhas ? 1 : 0);
