/**
 * Verificação da Fase 6 — dashboard, precificação e lives dentro do hub.
 *
 * Duas perguntas:
 *
 *   1. **O dado chegou inteiro?** Não basta contar linhas: compara número a
 *      número com o projeto antigo, somando o faturamento de cada empresa dos
 *      dois lados. Uma coluna trocada na cópia passaria por qualquer contagem.
 *   2. **Juntar os bancos abriu buraco?** A precificação e as lives são
 *      ferramentas internas: cliente logado tem que ler **zero** linha das duas,
 *      e enxergar só o próprio dashboard. `stream_key` não pode vazar, e o
 *      bucket dos vídeos — público no projeto antigo — tem que estar fechado.
 *
 * Cria usuário de teste com marca própria e apaga no fim.
 *
 * Uso:  node scripts/verify-phase6.mjs
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

// Projeto antigo: a chave está no .env do worker das lives.
const ENV_WORKER = join(raiz, "..", "dashboard-agencia", "lives-worker", ".env.projeto-antigo");
const antigo = (() => {
  try {
    const t = readFileSync(ENV_WORKER, "utf8");
    return {
      url: t.match(/^SUPABASE_URL=(.*)$/m)?.[1]?.trim(),
      chave: t.match(/^SUPABASE_SERVICE_ROLE=(.*)$/m)?.[1]?.trim(),
    };
  } catch {
    return null;
  }
})();

const MARCA = `vp6-${Date.now()}`;
const SENHA = "SenhaDeTeste123";
const emailCliente = `${MARCA}-cliente@exemplo-teste.com`;

let falhas = 0;
let pulados = 0;
function checar(ok, descricao, detalhe = "") {
  console.log(`${ok ? "  ok  " : "  FALHA"} ${descricao}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
}
function pular(descricao, porque) {
  console.log(`  pulado ${descricao} — ${porque}`);
  pulados++;
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

console.log(`\nVerificação da Fase 6 — projeto ${REF}\n`);

// ── 1. O dado chegou inteiro? ───────────────────────────────────────────────
console.log("Cópia do projeto antigo");

const contagens = await sql(`
  select
    (select count(*) from dashboard_periods) as periodos,
    (select count(*) from pricing_products)  as produtos,
    (select count(*) from pricing_config)    as configs,
    (select count(*) from live_materials)    as materiais,
    (select count(*) from live_sessions)     as sessoes,
    (select count(*) from orgs)              as orgs;
`);
const hub = contagens[0];

if (!antigo?.url || !antigo?.chave) {
  pular("comparação com o projeto antigo", "sem .env.projeto-antigo do worker");
} else {
  // O projeto antigo foi apagado depois da migração: o host deixa de resolver e
  // o `fetch` joga em vez de devolver status. Sem este try, a verificação inteira
  // morria aqui — e o que ela tem de mais importante (RLS, bucket) vem depois.
  let antigoRespondeu = true;
  const lerAntigo = async (caminho) => {
    try {
      const r = await fetch(`${antigo.url}/rest/v1/${caminho}`, {
        headers: { apikey: antigo.chave, Authorization: `Bearer ${antigo.chave}` },
      });
      return r.ok ? await r.json() : [];
    } catch {
      antigoRespondeu = false;
      return [];
    }
  };

  const [periodosAntigos, produtosAntigos, configsAntigas, materiaisAntigos, sessoesAntigas, clientesAntigos] =
    await Promise.all([
      lerAntigo("periods?select=id,client_id,period_date,fat_total"),
      lerAntigo("pricing_products?select=id"),
      lerAntigo("pricing_config?select=id"),
      lerAntigo("client_materials?select=id"),
      lerAntigo("live_sessions?select=id"),
      lerAntigo("clients?select=id,name,slug"),
    ]);

  if (!antigoRespondeu) {
    pular("comparação com o projeto antigo", "projeto apagado — nada com que comparar");
  } else {
  checar(Number(hub.periodos) === periodosAntigos.length,
    "períodos: mesma quantidade", `hub ${hub.periodos} · antigo ${periodosAntigos.length}`);
  checar(Number(hub.produtos) === produtosAntigos.length,
    "produtos de precificação: mesma quantidade", `hub ${hub.produtos} · antigo ${produtosAntigos.length}`);
  checar(Number(hub.configs) === configsAntigas.length,
    "configurações de precificação: mesma quantidade", `hub ${hub.configs} · antigo ${configsAntigas.length}`);
  checar(Number(hub.materiais) === materiaisAntigos.length,
    "materiais de live: mesma quantidade", `hub ${hub.materiais} · antigo ${materiaisAntigos.length}`);
  checar(Number(hub.sessoes) === sessoesAntigas.length,
    "sessões de live: mesma quantidade", `hub ${hub.sessoes} · antigo ${sessoesAntigas.length}`);

  // Número a número, casado pelo **id**: a cópia preserva o UUID de cada linha,
  // então dá para conferir sem depender de nome — e nome mudaria de qualquer
  // forma ("BB Onça Burguer's" no antigo, "BB Onça" na org do hub).
  const noHub = new Map(
    (await sql(`select id::text, period_date::text, fat_total from dashboard_periods;`))
      .map((p) => [p.id, p]),
  );

  const divergentes = [];
  for (const antigoP of periodosAntigos) {
    const copia = noHub.get(antigoP.id);
    if (!copia) {
      divergentes.push(`${antigoP.id.slice(0, 8)} não veio`);
      continue;
    }
    if (copia.period_date !== antigoP.period_date) {
      divergentes.push(`${antigoP.id.slice(0, 8)}: mês ${copia.period_date} ≠ ${antigoP.period_date}`);
    }
    if (Math.abs(Number(copia.fat_total ?? 0) - Number(antigoP.fat_total ?? 0)) > 0.01) {
      divergentes.push(`${antigoP.id.slice(0, 8)}: fat ${copia.fat_total} ≠ ${antigoP.fat_total}`);
    }
  }
  checar(divergentes.length === 0,
    "mês e faturamento batem linha a linha",
    divergentes.length ? divergentes.slice(0, 3).join("; ") : `${periodosAntigos.length} períodos`);

  // As empresas do antigo têm todas uma org correspondente?
  const orgsComPeriodo = await sql(`
    select count(distinct org_id) as n from dashboard_periods;
  `);
  const clientesComPeriodo = new Set(periodosAntigos.map((p) => p.client_id)).size;
  checar(Number(orgsComPeriodo[0].n) === clientesComPeriodo,
    "cada cliente do antigo virou uma empresa aqui",
    `${orgsComPeriodo[0].n} orgs · ${clientesComPeriodo} clientes · ${clientesAntigos.length} cadastrados`);
  }
}

checar(
  Number(hub.periodos) > 0 && Number(hub.produtos) > 0 && Number(hub.materiais) > 0,
  "o hub tem o dado das três frentes",
  `${hub.periodos} meses · ${hub.produtos} produtos · ${hub.materiais} materiais`,
);

// ── 2. O que o cliente enxerga ──────────────────────────────────────────────
console.log("\nIsolamento");

// Empresa com período publicado, para o cliente de teste ter o que ver.
const alvo = (await sql(`
  select o.id, o.name, count(dp.id) as meses
  from orgs o join dashboard_periods dp on dp.org_id = o.id
  group by o.id, o.name order by count(dp.id) desc limit 1;
`))[0];

const idCliente = await cadastrar(emailCliente);
await sql(`insert into memberships (user_id, org_id, role) values ('${idCliente}', '${alvo.id}', 'owner');`);
const comoCliente = rest(await entrar(emailCliente));
const semSessao = rest(null);

try {
  const meus = await comoCliente(`dashboard_periods?select=id&org_id=eq.${alvo.id}`);
  checar(Array.isArray(meus.corpo) && meus.corpo.length === Number(alvo.meses),
    `cliente vê os ${alvo.meses} meses da própria empresa`,
    `${Array.isArray(meus.corpo) ? meus.corpo.length : meus.status}`);

  const todos = await comoCliente("dashboard_periods?select=id");
  checar(Array.isArray(todos.corpo) && todos.corpo.length === Number(alvo.meses),
    "cliente não vê período de outra empresa",
    `leu ${Array.isArray(todos.corpo) ? todos.corpo.length : todos.status} de ${hub.periodos}`);

  const precos = await comoCliente("pricing_products?select=id");
  checar(Array.isArray(precos.corpo) && precos.corpo.length === 0,
    "cliente lê 0 linhas da precificação (é ferramenta da agência)");

  const configPreco = await comoCliente("pricing_config?select=id");
  checar(Array.isArray(configPreco.corpo) && configPreco.corpo.length === 0,
    "cliente lê 0 linhas da configuração de preço");

  const lives = await comoCliente("live_sessions?select=id");
  checar(Array.isArray(lives.corpo) && lives.corpo.length === 0,
    "cliente lê 0 linhas de live_sessions (stream_key mora lá)");

  const materiais = await comoCliente("live_materials?select=id");
  checar(Array.isArray(materiais.corpo) && materiais.corpo.length === 0,
    "cliente lê 0 linhas de live_materials");

  const anonPeriodos = await semSessao("dashboard_periods?select=id");
  checar(!Array.isArray(anonPeriodos.corpo) || anonPeriodos.corpo.length === 0,
    "sem sessão não lê período nenhum", `HTTP ${anonPeriodos.status}`);

  // A função é `security definer` e responde a partir de `auth.uid()` — pelo
  // SQL de gestão não há usuário, e ela devolveria tudo falso. Tem que ser pela
  // sessão do cliente, que é como o portal chama.
  const modulos = await comoCliente(
    `rpc/modulos_configurados?p_org=${alvo.id}`,
  );
  checar(modulos.corpo?.dashboard === true,
    "cliente com mês publicado vê o card do dashboard aceso",
    JSON.stringify(modulos.corpo));

  const outra = await sql(`
    select o.id from orgs o
    left join dashboard_periods dp on dp.org_id = o.id
    where dp.id is null and o.id <> '${alvo.id}' limit 1;
  `);
  if (outra.length) {
    const m = await comoCliente(`rpc/modulos_configurados?p_org=${outra[0].id}`);
    checar(m.corpo?.dashboard === false,
      "empresa alheia não vira oráculo: responde tudo falso");
  } else {
    pular("empresa sem mês publicado", "todas têm período");
  }
  // ── Ponta a ponta: `?org=` é privilégio de agência ────────────────────────
  // Herdado do verify da Fase 2, que morreu junto com a RPC antiga. A checagem
  // continua valendo: quem não é agência não pode espiar outra empresa pela
  // query string.
  const BASE_APP = process.env.HUB_URL ?? "http://localhost:3000";
  const outraOrg = (await sql(`
    select o.id, o.name from orgs o
    join dashboard_periods dp on dp.org_id = o.id
    where o.id <> '${alvo.id}' limit 1;
  `))[0];

  const respondendo = await fetch(`${BASE_APP}/api/health`)
    .then((r) => r.ok)
    .catch(() => false);

  if (!respondendo) {
    pular("dashboard ponta a ponta", `app não responde em ${BASE_APP}`);
  } else if (!outraOrg) {
    pular("dashboard ponta a ponta", "só uma empresa com período");
  } else {
    const { createServerClient } = await import("@supabase/ssr");
    const cofre = new Map();
    const cli = createServerClient(URL_BASE, ANON, {
      cookies: {
        getAll: () => [...cofre].map(([name, value]) => ({ name, value })),
        setAll: (l) => l.forEach(({ name, value }) => cofre.set(name, value)),
      },
    });
    await cli.auth.signInWithPassword({ email: emailCliente, password: SENHA });
    const cookie = [...cofre].map(([n, v]) => `${n}=${v}`).join("; ");

    const pegar = (caminho) =>
      fetch(`${BASE_APP}${caminho}`, { headers: { cookie } }).then(async (r) => ({
        status: r.status,
        html: await r.text(),
      }));

    const propria = await pegar("/dashboard");
    checar(propria.status === 200 && propria.html.includes(alvo.name),
      "cliente abre o próprio dashboard", `HTTP ${propria.status}`);

    const espiando = await pegar(`/dashboard?org=${outraOrg.id}`);
    checar(!espiando.html.includes(outraOrg.name),
      "`?org=` é ignorado para quem não é agência");
  }
} finally {
  await sql(`delete from memberships where user_id = '${idCliente}';`);
  await sql(`delete from auth.users where id = '${idCliente}';`);
}

// ── 3. Os arquivos ─────────────────────────────────────────────────────────
console.log("\nArquivos");

const buckets = await sql(`select id, public from storage.buckets where id in ('logos','materials') order by id;`);
const materials = buckets.find((b) => b.id === "materials");
const logos = buckets.find((b) => b.id === "logos");

checar(materials && materials.public === false,
  "bucket materials é privado (no projeto antigo era público)");
checar(logos && logos.public === true, "bucket logos segue público (é a logo do topo)");

const objetos = await sql(`
  select bucket_id, count(*) as n from storage.objects
  where bucket_id in ('logos','materials') group by bucket_id order by bucket_id;
`);
const conta = (b) => Number(objetos.find((o) => o.bucket_id === b)?.n ?? 0);
checar(conta("logos") >= 11, "logos copiados", `${conta("logos")} arquivos`);
checar(conta("materials") >= 5, "vídeos copiados", `${conta("materials")} arquivos`);

const umVideo = await sql(`
  select name from storage.objects where bucket_id = 'materials' limit 1;
`);
if (umVideo.length) {
  const r = await fetch(`${URL_BASE}/storage/v1/object/public/materials/${umVideo[0].name}`);
  checar(!r.ok, "vídeo não abre por link público", `HTTP ${r.status}`);
} else {
  pular("link público do vídeo", "bucket vazio");
}

const caminhosSoltos = await sql(`
  select count(*) as n from live_materials
  where source_url like 'http%' or file_url like 'http%';
`);
checar(Number(caminhosSoltos[0].n) === 0,
  "materiais guardam caminho no bucket, não URL pública");

console.log(
  `\n${falhas ? `${falhas} FALHA(S)` : "tudo verde"}${pulados ? ` · ${pulados} pulado(s)` : ""}\n`,
);
process.exit(falhas ? 1 : 0);
