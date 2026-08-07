/**
 * Verificação da Fase 4 — Fila de Espera no banco do hub.
 *
 * A pergunta que este arquivo responde é uma só: **juntar os dois bancos abriu
 * algum buraco entre os módulos?** Por isso as asserções mais importantes aqui
 * não são sobre o Fila funcionar (a suíte do próprio Fila cobre isso), e sim
 * sobre quem **não** pode ver o que:
 *
 *   - usuário do portal, com membership na mesma empresa mas **sem `profiles`**,
 *     lê 0 linhas das tabelas do Fila;
 *   - a **agência também lê 0 linhas** do Fila. As policies do Fila não têm ramo
 *     `is_agency()` e a recomendação é manter assim — a agência não tem o que
 *     fazer com nome, telefone e data de nascimento dos clientes do salão. Esta
 *     asserção existe para ninguém adicionar o bypass por reflexo;
 *   - no sentido inverso, usuário do Fila lê 0 linhas de `orgs`, `memberships`,
 *     `entitlements` e `link_pages`.
 *
 * Mais: isolamento entre restaurantes, `partner` continua só-leitura (inclusive
 * sem conseguir se promover a `host`), a FK de tenancy segura os dois lados, e o
 * realtime entrega evento da empresa certa e não entrega da errada.
 *
 * Cria tudo com uma marca própria e apaga no fim.
 *
 * Uso:  node scripts/verify-phase4.mjs
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

const MARCA = `vp4-${Date.now()}`;
const SENHA = "SenhaDeTeste123";
const emails = {
  hostA: `${MARCA}-host-a@exemplo-teste.com`,
  hostB: `${MARCA}-host-b@exemplo-teste.com`,
  partnerA: `${MARCA}-partner-a@exemplo-teste.com`,
  portalA: `${MARCA}-portal-a@exemplo-teste.com`,
  agencia: `${MARCA}-agencia@exemplo-teste.com`,
};

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

/** Igual ao verify da Fase 1: /auth/v1/signup recusa domínio de teste. */
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
  const r = await sql(`select id from auth.users where email = '${email}';`);
  return r[0].id;
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

const vazio = (r) => Array.isArray(r.corpo) && r.corpo.length === 0;

async function limpar() {
  // Ordem manda: `profiles.restaurant_id` é `on delete restrict`, então os
  // usuários (que levam os profiles junto por cascade) saem antes dos
  // restaurantes; e `restaurants.id -> orgs.id` também é restrict, então os
  // restaurantes saem antes das empresas.
  await sql(`delete from auth.users where email like '${MARCA}-%';`);
  await sql(`delete from public.restaurants where slug like '${MARCA}-%';`);
  await sql(`delete from public.orgs where slug like '${MARCA}-%';`);
}

/**
 * Escuta inserts em `waiting_entries` com o token de um usuário e devolve os
 * `restaurant_id` que chegaram. O realtime aplica a mesma RLS do REST — é essa
 * a propriedade sob teste, porque um realtime que entrega demais vaza a fila de
 * outro cliente, e um que não entrega nada quebra o balcão em silêncio.
 *
 * Duas armadilhas do `supabase-js` moram nestas três linhas, e as duas fazem o
 * canal conectar como `anon` — a RLS barra tudo e o teste acusa realtime morto
 * quando o realtime está bom:
 *
 * 1. **Sem a opção `accessToken`**, o client registra um listener de auth que,
 *    ao ver sessão nula (é o caso aqui: o token veio do REST, não de um
 *    `signIn`), chama `realtime.setAuth()` **sem token** e apaga o que acabamos
 *    de setar.
 * 2. **Com a opção `accessToken`**, o client seta o token do realtime dentro de
 *    um `.then()` que ninguém espera. Se o `subscribe()` sair antes desse
 *    microtask, o canal já entrou sem token. Daí o `setAuth` explícito e
 *    aguardado abaixo.
 *
 * Nada disso é problema do app: o Fila usa `@supabase/ssr` com sessão de
 * verdade, e aí o listener seta o token certo sozinho.
 */
async function escutarInserts(token, milissegundos) {
  const cli = createClient(URL_BASE, ANON, {
    accessToken: async () => token,
    realtime: { params: { eventsPerSecond: 10 } },
  });
  await cli.realtime.setAuth(token);

  const recebidos = [];
  const canal = cli.channel(`fase4-${Math.random().toString(36).slice(2)}`).on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "waiting_entries" },
    (p) => recebidos.push(p.new?.restaurant_id),
  );

  const inscrito = await new Promise((resolve) => {
    const t = setTimeout(() => resolve(false), 15000);
    canal.subscribe((estado) => {
      if (estado === "SUBSCRIBED") {
        clearTimeout(t);
        resolve(true);
      }
      if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") {
        clearTimeout(t);
        resolve(false);
      }
    });
  });

  // `SUBSCRIBED` diz que o canal entrou, não que o servidor já registrou a
  // assinatura no listener do WAL. Inserir nesse intervalo perde o evento para
  // sempre — `postgres_changes` não reenvia o passado — e o teste acusa realtime
  // morto sem haver nada morto. No app isso não acontece: a tela do balcão
  // assina quando abre, muito antes de alguém cadastrar alguém.
  if (inscrito) await new Promise((r) => setTimeout(r, 3000));

  return {
    inscrito,
    async colher() {
      await new Promise((r) => setTimeout(r, milissegundos));
      await cli.removeAllChannels();
      cli.realtime.disconnect();
      return recebidos;
    },
  };
}

async function main() {
  console.log(`Projeto ${REF} — marca de teste ${MARCA}\n`);

  // --- preparo -------------------------------------------------------------
  // Duas empresas; cada uma vira também um restaurante com o MESMO id — é a
  // invariante da fase, e criar assim já exercita a FK de tenancy.
  const orgs = await sql(`
    insert into public.orgs (name, slug) values
      ('Empresa A ${MARCA}', '${MARCA}-a'),
      ('Empresa B ${MARCA}', '${MARCA}-b')
    returning id, slug;
  `);
  const orgA = orgs.find((o) => o.slug.endsWith("-a")).id;
  const orgB = orgs.find((o) => o.slug.endsWith("-b")).id;

  await sql(`
    insert into public.restaurants (id, name, slug) values
      ('${orgA}', 'Restaurante A ${MARCA}', '${MARCA}-ra'),
      ('${orgB}', 'Restaurante B ${MARCA}', '${MARCA}-rb');
    insert into public.entitlements (org_id, module, enabled) values
      ('${orgA}', 'fila', true), ('${orgB}', 'fila', true);
    -- Só o usuário do portal e a agência têm convite: os usuários do Fila
    -- entram sem membership nenhum, que é como ficam em produção.
    insert into public.invites (email, org_id, role) values
      ('${emails.portalA}', '${orgA}', 'owner'),
      ('${emails.agencia}', '${orgA}', 'agency');
  `);

  const ids = {};
  for (const [chave, email] of Object.entries(emails)) ids[chave] = await cadastrar(email);

  await sql(`
    insert into public.profiles (id, restaurant_id, name, role) values
      ('${ids.hostA}',    '${orgA}', 'Host A',    'host'),
      ('${ids.partnerA}', '${orgA}', 'Partner A', 'partner'),
      ('${ids.hostB}',    '${orgB}', 'Host B',    'host');
  `);

  const clientes = await sql(`
    insert into public.customers (restaurant_id, name, phone) values
      ('${orgA}', 'Cliente A', '${MARCA}-a'),
      ('${orgB}', 'Cliente B', '${MARCA}-b')
    returning id, restaurant_id;
  `);
  const clienteA = clientes.find((c) => c.restaurant_id === orgA).id;
  const clienteB = clientes.find((c) => c.restaurant_id === orgB).id;

  await sql(`
    insert into public.environments (restaurant_id, name) values
      ('${orgA}', 'Salão A'), ('${orgB}', 'Salão B');
    insert into public.waiting_entries (restaurant_id, customer_id, party_size, estimated_wait_minutes)
      values ('${orgA}', '${clienteA}', 2, 10), ('${orgB}', '${clienteB}', 4, 20);
    insert into public.audit_logs (restaurant_id, user_id, action) values
      ('${orgA}', '${ids.hostA}', 'teste'), ('${orgB}', '${ids.hostB}', 'teste');
  `);

  const A = rest(await entrar(emails.hostA));
  const P = rest(await entrar(emails.partnerA));
  const Portal = rest(await entrar(emails.portalA));
  const Ag = rest(await entrar(emails.agencia));

  // --- isolamento entre restaurantes ---------------------------------------
  console.log("Isolamento entre restaurantes");
  for (const [tabela, coluna] of [
    ["customers", "restaurant_id"],
    ["waiting_entries", "restaurant_id"],
    ["environments", "restaurant_id"],
    ["audit_logs", "restaurant_id"],
  ]) {
    const r = await A(`${tabela}?select=${coluna}`);
    checar(
      Array.isArray(r.corpo) && r.corpo.length > 0 && r.corpo.every((l) => l[coluna] === orgA),
      `host A só vê ${tabela} do próprio restaurante`,
      `HTTP ${r.status}, ${Array.isArray(r.corpo) ? r.corpo.length : "?"} linha(s)`,
    );
  }
  const restA = await A("restaurants?select=id");
  checar(
    Array.isArray(restA.corpo) && restA.corpo.length === 1 && restA.corpo[0].id === orgA,
    "host A só vê o próprio restaurante",
    `veio ${JSON.stringify(restA.corpo)}`,
  );
  checar(vazio(await A(`customers?select=id&restaurant_id=eq.${orgB}`)), "host A não alcança clientes de B");

  // --- o buraco que a fusão poderia ter aberto ------------------------------
  console.log("\nPortal não enxerga o Fila");
  const membPortal = await sql(
    `select count(*)::int n from public.memberships where user_id = '${ids.portalA}' and org_id = '${orgA}';`,
  );
  checar(membPortal[0].n === 1, "usuário do portal tem membership na mesma empresa", "pré-condição do teste");
  for (const tabela of ["customers", "waiting_entries", "restaurants", "audit_logs", "environments", "profiles"]) {
    checar(vazio(await Portal(`${tabela}?select=id`)), `portal (sem profiles) lê 0 linhas de ${tabela}`);
  }

  console.log("\nAgência não enxerga o Fila");
  for (const tabela of ["customers", "waiting_entries", "restaurants", "audit_logs", "environments", "profiles"]) {
    checar(vazio(await Ag(`${tabela}?select=id`)), `agência lê 0 linhas de ${tabela}`);
  }
  const orgsAg = await Ag(`orgs?select=id&or=(id.eq.${orgA},id.eq.${orgB})`);
  checar(
    Array.isArray(orgsAg.corpo) && orgsAg.corpo.length === 2,
    "agência continua enxergando as empresas (o corte é só no Fila)",
  );

  console.log("\nFila não enxerga o portal");
  for (const tabela of ["orgs", "memberships", "entitlements", "link_pages", "link_buttons", "link_clicks"]) {
    checar(vazio(await A(`${tabela}?select=id`)), `host A lê 0 linhas de ${tabela}`);
  }
  checar(vazio(await A("invites?select=id")), "host A lê 0 linhas de invites");

  // --- partner só-leitura ---------------------------------------------------
  console.log("\nPartner continua só-leitura");
  const leP = await P("customers?select=id");
  checar(Array.isArray(leP.corpo) && leP.corpo.length === 1, "partner lê clientes do próprio restaurante");

  const insP = await P("customers", {
    method: "POST",
    body: JSON.stringify({ restaurant_id: orgA, name: "Invasor", phone: `${MARCA}-x` }),
  });
  const depoisIns = await sql(
    `select count(*)::int n from public.customers where phone = '${MARCA}-x';`,
  );
  checar(depoisIns[0].n === 0, "partner não insere cliente", `HTTP ${insP.status}`);

  const updP = await P(`waiting_entries?restaurant_id=eq.${orgA}`, {
    method: "PATCH",
    body: JSON.stringify({ table_number: "99" }),
  });
  const depoisUpd = await sql(
    `select count(*)::int n from public.waiting_entries where restaurant_id = '${orgA}' and table_number = '99';`,
  );
  checar(depoisUpd[0].n === 0, "partner não altera a fila", `HTTP ${updP.status}`);

  const escalada = await P(`profiles?id=eq.${ids.partnerA}`, {
    method: "PATCH",
    body: JSON.stringify({ role: "host" }),
  });
  const papel = await sql(`select role from public.profiles where id = '${ids.partnerA}';`);
  checar(papel[0].role === "partner", "partner não se promove a host", `HTTP ${escalada.status}`);

  // --- FK de tenancy --------------------------------------------------------
  console.log("\nFK de tenancy");
  let recusou = false;
  try {
    await sql(`insert into public.restaurants (id, name, slug)
               values (gen_random_uuid(), 'Sem empresa', '${MARCA}-orfao');`);
  } catch {
    recusou = true;
  }
  checar(recusou, "restaurante sem empresa é recusado");

  let recusouDelete = false;
  try {
    await sql(`delete from public.orgs where id = '${orgB}';`);
  } catch {
    recusouDelete = true;
  }
  const bAindaExiste = await sql(`select count(*)::int n from public.orgs where id = '${orgB}';`);
  checar(
    recusouDelete && bAindaExiste[0].n === 1,
    "apagar empresa com restaurante falha alto (restrict, não cascade)",
  );

  // --- realtime -------------------------------------------------------------
  console.log("\nRealtime");
  const escuta = await escutarInserts(await entrar(emails.hostA), 6000);
  checar(escuta.inscrito, "host A conseguiu se inscrever no canal");
  if (escuta.inscrito) {
    await sql(`
      insert into public.waiting_entries (restaurant_id, customer_id, party_size, estimated_wait_minutes)
        values ('${orgA}', '${clienteA}', 3, 15), ('${orgB}', '${clienteB}', 3, 15);
    `);
    const recebidos = await escuta.colher();
    checar(recebidos.includes(orgA), "evento do próprio restaurante chega", `recebidos: ${recebidos.length}`);
    checar(!recebidos.includes(orgB), "evento do outro restaurante NÃO chega");
  }

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
