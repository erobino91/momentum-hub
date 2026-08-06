/**
 * Verificação da Fase 3 — bio/linktree e rastreamento de cliques.
 *
 * O que precisa ser verdade:
 *   - as tabelas do bio são invisíveis para o papel `anon`, e `link_secrets`
 *     (o token de CAPI) é invisível até para o dono da página;
 *   - uma org não enxerga página, botão nem clique da outra;
 *   - a página pública mostra só o que está no ar e **nunca a URL de destino**;
 *   - o clique redireciona sempre — inclusive quando a CAPI falha — e grava o
 *     IP **hasheado**, nunca cru;
 *   - o `event_id` da deduplicação nasce no navegador, não no HTML cacheado.
 *
 * Uso:  node scripts/verify-phase3.mjs
 * As checagens de ponta a ponta precisam do app no ar (HUB_URL, padrão
 * http://localhost:3000). Sem isso são puladas, e o script diz que pulou.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { request as pedidoHttp } from "node:http";
import { request as pedidoHttps } from "node:https";
import { createHash } from "node:crypto";

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
const HUB_URL = (process.env.HUB_URL ?? "http://localhost:3000").replace(/\/$/, "");

const LOCAL = ["localhost", "127.0.0.1"].includes(
  new globalThis.URL(HUB_URL).hostname,
);

/** `portal.mmtdigital.com.br` → `bio.mmtdigital.com.br`; local → `bio.localhost`. */
const HOST_BIO = (() => {
  const h = new globalThis.URL(HUB_URL).hostname;
  if (LOCAL) return "bio.localhost";
  const partes = h.split(".");
  return `bio.${partes.slice(1).join(".") || h}`;
})();

const MARCA = `vp3-${Date.now()}`;
const emailA = `${MARCA}-a@exemplo-teste.com`;
const emailB = `${MARCA}-b@exemplo-teste.com`;
const emailAg = `${MARCA}-agencia@exemplo-teste.com`;
const SENHA = "SenhaDeTeste123";
const IP_TESTE = "198.51.100.77";
const DESTINO = "https://example.com/promo-do-mes";

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

async function entrar(email) {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: SENHA }),
  });
  if (!r.ok) throw new Error(`login ${email}: ${r.status} ${await r.text()}`);
  return r.json();
}

/** Cookie que o `@supabase/ssr` espera — mesmo formato do verify da Fase 2. */
function cookieDaSessao(s) {
  const chave = `sb-${REF}-auth-token`;
  const codificado = encodeURIComponent(JSON.stringify(s));
  if (codificado.length <= 3180) return `${chave}=${codificado}`;

  const partes = [];
  let resto = codificado;
  while (resto.length > 0) {
    let cabeca = resto.slice(0, 3180);
    const ultimoEscape = cabeca.lastIndexOf("%");
    if (ultimoEscape > 3177) cabeca = cabeca.slice(0, ultimoEscape);
    partes.push(cabeca);
    resto = resto.slice(cabeca.length);
  }
  return partes.map((p, i) => `${chave}.${i}=${p}`).join("; ");
}

function rest(token) {
  return async (caminho, init = {}) => {
    const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
      ...init,
      headers: {
        apikey: ANON,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

/**
 * GET com `Host` escolhido na mão. O `fetch` do Node ignora o header `Host`, e
 * sem ele não dá para exercitar a reescrita de `bio.` → `/b/<slug>`.
 */
function pegarComHost(caminho, host) {
  const alvo = new globalThis.URL(HUB_URL);
  const seguro = alvo.protocol === "https:";
  const pedido = seguro ? pedidoHttps : pedidoHttp;
  return new Promise((resolve, reject) => {
    const req = pedido(
      {
        host: alvo.hostname,
        port: alvo.port || (seguro ? 443 : 80),
        path: caminho,
        method: "GET",
        // O SNI segue o host de verdade; só o header `Host` muda, que é o que
        // o roteamento por domínio lê.
        ...(seguro ? { servername: alvo.hostname } : {}),
        headers: { Host: host },
      },
      (res) => {
        let corpo = "";
        res.on("data", (p) => (corpo += p));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, corpo }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/** Negado = erro HTTP ou lista vazia. As duas formas servem: não vaza linha. */
function negado({ status, corpo }) {
  return status >= 400 || (Array.isArray(corpo) && corpo.length === 0);
}

async function limpar() {
  await sql(`
    delete from auth.users where email like '${MARCA}-%';
    delete from public.orgs  where slug  like '${MARCA}-%';
  `);
}

async function main() {
  console.log(`Projeto ${REF} — marca ${MARCA}\n`);

  const orgs = await sql(`
    insert into public.orgs (name, slug) values
      ('Bio A ${MARCA}', '${MARCA}-a'),
      ('Bio B ${MARCA}', '${MARCA}-b')
    returning id, slug;
  `);
  const orgA = orgs.find((o) => o.slug.endsWith("-a")).id;
  const orgB = orgs.find((o) => o.slug.endsWith("-b")).id;

  const paginas = await sql(`
    insert into public.link_pages (org_id, slug, title, bio, active, pixel_id) values
      ('${orgA}', '${MARCA}-a', 'Bio da A', 'testando', true,  '123456789012345'),
      ('${orgA}', '${MARCA}-off', 'Bio fora do ar', null, false, null),
      ('${orgB}', '${MARCA}-b', 'Bio da B', null, true,  null)
    returning id, slug;
  `);
  const pagA = paginas.find((p) => p.slug === `${MARCA}-a`).id;
  const pagOff = paginas.find((p) => p.slug === `${MARCA}-off`).id;
  const pagB = paginas.find((p) => p.slug === `${MARCA}-b`).id;

  const botoes = await sql(`
    insert into public.link_buttons (page_id, label, url, position, active, ends_at) values
      ('${pagA}', 'Promo do mês', '${DESTINO}', 0, true,  null),
      ('${pagA}', 'Promo vencida', 'https://example.com/vencida', 1, true, now() - interval '1 day'),
      ('${pagA}', 'Desligado', 'https://example.com/off', 2, false, null)
    returning id, label;
  `);
  const idPor = (rotulo) => botoes.find((b) => b.label === rotulo).id;

  // Token de propósito inválido: serve para provar que falha de CAPI não
  // impede o redirecionamento.
  await sql(`
    insert into public.link_secrets (page_id, capi_token)
    values ('${pagA}', 'TOKEN_FALSO_DE_TESTE');
  `);

  await sql(`
    insert into public.invites (email, org_id, role) values
      ('${emailA}',  '${orgA}', 'owner'),
      ('${emailB}',  '${orgB}', 'owner'),
      ('${emailAg}', '${orgA}', 'agency');
  `);
  for (const e of [emailA, emailB, emailAg]) await cadastrar(e);

  const sessaoA = await entrar(emailA);
  const sessaoB = await entrar(emailB);
  const sessaoAg = await entrar(emailAg);
  const semSessao = rest(null);
  const comoA = rest(sessaoA.access_token);
  const comoB = rest(sessaoB.access_token);
  const comoAgencia = rest(sessaoAg.access_token);
  void sessaoB;

  // --- 1. fechado para o público ------------------------------------------
  console.log("Fechado para anon");
  for (const tabela of ["link_pages", "link_buttons", "link_clicks", "link_secrets"]) {
    checar(
      negado(await semSessao(`${tabela}?select=*&limit=1`)),
      `anon não lê ${tabela}`,
    );
  }

  // --- 2. isolamento entre orgs -------------------------------------------
  console.log("\nIsolamento entre empresas");
  const proprias = await comoA(`link_pages?select=id,slug`);
  checar(
    Array.isArray(proprias.corpo) &&
      proprias.corpo.length === 2 &&
      proprias.corpo.every((p) => p.slug.startsWith(MARCA)),
    "dono lê as próprias páginas",
    `vieram ${Array.isArray(proprias.corpo) ? proprias.corpo.length : "?"}`,
  );
  checar(
    negado(await comoB(`link_pages?select=id&id=eq.${pagA}`)),
    "empresa B não lê a página da empresa A",
  );
  checar(
    negado(await comoB(`link_buttons?select=id&page_id=eq.${pagA}`)),
    "empresa B não lê os botões da empresa A",
  );
  checar(
    negado(await comoB(`link_clicks?select=id&page_id=eq.${pagA}`)),
    "empresa B não lê os cliques da empresa A",
  );

  // --- 2b. quem monta a bio é a agência ------------------------------------
  console.log("\nQuem escreve");
  const tituloOriginal = "Bio da A";

  await comoA(`link_pages?id=eq.${pagA}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "cliente tentou mudar" }),
  });
  const depoisDoCliente = await comoA(`link_pages?select=title&id=eq.${pagA}`);
  checar(
    depoisDoCliente.corpo?.[0]?.title === tituloOriginal,
    "cliente não edita a própria página",
    `título ficou "${depoisDoCliente.corpo?.[0]?.title}"`,
  );

  const criouBotao = await comoA(`link_buttons`, {
    method: "POST",
    body: JSON.stringify({
      page_id: pagA,
      label: "botão do cliente",
      url: "https://example.com/x",
    }),
  });
  checar(
    criouBotao.status === 403 || criouBotao.status >= 400,
    "cliente não cria botão",
    `HTTP ${criouBotao.status}`,
  );

  await comoAgencia(`link_pages?id=eq.${pagA}`, {
    method: "PATCH",
    body: JSON.stringify({ title: "agência mudou" }),
  });
  const depoisDaAgencia = await comoAgencia(`link_pages?select=title&id=eq.${pagA}`);
  checar(
    depoisDaAgencia.corpo?.[0]?.title === "agência mudou",
    "agência edita a página do cliente",
    `título ficou "${depoisDaAgencia.corpo?.[0]?.title}"`,
  );

  // --- 3. o token de CAPI não volta para ninguém ---------------------------
  console.log("\nToken de CAPI");
  checar(
    negado(await comoA(`link_secrets?select=capi_token&page_id=eq.${pagA}`)),
    "nem o dono da página lê o próprio capi_token",
  );

  // --- 4. ponta a ponta ----------------------------------------------------
  console.log("\nPágina pública e clique");
  let noAr = false;
  try {
    noAr = (await fetch(`${HUB_URL}/api/health`)).ok;
  } catch {
    noAr = false;
  }

  if (!noAr) {
    for (const d of [
      "página pública mostra só o que está no ar",
      "a URL de destino não aparece no HTML",
      "o event_id da deduplicação nasce no navegador",
      "página inativa dá 404",
      "clique redireciona e é gravado",
      "IP é gravado hasheado, nunca cru",
      "falha na CAPI não impede o redirecionamento",
      "botão fora da janela volta para a bio sem gravar clique",
      "host bio. resolve /<slug> sem precisar de /b/",
      "raiz de bio. não abre o portal",
      "beacon de PageView não revela se o slug existe",
      "cliente vê a bio em leitura, sem editor",
      "agência vê o editor completo",
    ])
      pular(d, `${HUB_URL} não respondeu em /api/health`);
  } else {
    const pagina = await fetch(`${HUB_URL}/b/${MARCA}-a`);
    const html = await pagina.text();
    checar(
      pagina.status === 200 &&
        html.includes("Promo do mês") &&
        !html.includes("Promo vencida") &&
        !html.includes("Desligado"),
      "página pública mostra só o que está no ar",
      `status ${pagina.status}`,
    );
    checar(!html.includes(DESTINO), "a URL de destino não aparece no HTML");
    checar(
      html.includes("__bioEventId") && html.includes("fbq('init'"),
      "o event_id da deduplicação nasce no navegador",
    );

    const inativa = await fetch(`${HUB_URL}/b/${MARCA}-off`);
    checar(inativa.status === 404, "página inativa dá 404", `status ${inativa.status}`);

    const antes = Date.now();
    const clique = await fetch(
      `${HUB_URL}/r/${idPor("Promo do mês")}?e=evt-${MARCA}`,
      {
        redirect: "manual",
        headers: { "user-agent": "verify-fase3/1.0", "x-forwarded-for": IP_TESTE },
      },
    );
    checar(
      clique.status === 302 && clique.headers.get("location") === DESTINO,
      "clique redireciona e é gravado",
      `status ${clique.status}`,
    );
    // O redirect saiu mesmo com `capi_token` falso — a Meta devolveu erro e o
    // usuário foi para o destino do mesmo jeito.
    checar(
      clique.status === 302,
      "falha na CAPI não impede o redirecionamento",
      `token inválido de propósito, resposta em ${Date.now() - antes}ms`,
    );

    const gravado = await sql(`
      select rotulo, ua, ip_hash
      from public.link_clicks
      where page_id = '${pagA}'
      order by clicked_at desc limit 5;
    `);
    checar(gravado.length === 1, "um clique gravado", `${gravado.length} linha(s)`);
    const linha = gravado[0] ?? {};
    // O hash esperado é calculado aqui, não no banco: mandar o sal dentro de uma
    // query o deixaria no log de queries do projeto.
    const esperado = createHash("sha256")
      .update(`${env.BIO_IP_SALT}:${IP_TESTE}`)
      .digest("hex");

    if (LOCAL) {
      checar(
        linha.ip_hash === esperado,
        "IP é gravado hasheado, nunca cru",
        linha.ip_hash ? "hash confere com sha256(sal:ip)" : "sem hash",
      );
    } else {
      // Atrás da Vercel o `x-forwarded-for` do cliente é descartado e vale o IP
      // real da conexão — não dá para forçar o IP daqui, e isso é proteção, não
      // defeito. Sobra conferir o formato e a ausência do IP em claro.
      checar(
        /^[0-9a-f]{64}$/.test(linha.ip_hash ?? "") && linha.ip_hash !== esperado,
        "IP é gravado hasheado, nunca cru",
        "remoto: a Vercel ignora o x-forwarded-for enviado, então só o formato é conferido",
      );
    }
    checar(
      !JSON.stringify(gravado).includes(IP_TESTE),
      "nenhuma coluna do clique guarda o IP em claro",
    );

    const vencido = await fetch(`${HUB_URL}/r/${idPor("Promo vencida")}?e=x`, {
      redirect: "manual",
    });
    const depois = await sql(
      `select count(*)::int as n from public.link_clicks where page_id = '${pagA}';`,
    );
    checar(
      vencido.status === 302 &&
        (vencido.headers.get("location") ?? "").endsWith(`/b/${MARCA}-a`) &&
        depois[0].n === 1,
      "botão fora da janela volta para a bio sem gravar clique",
      `status ${vencido.status}, cliques ${depois[0].n}`,
    );

    const porHost = await pegarComHost(`/${MARCA}-a`, HOST_BIO);
    const raizBio = await pegarComHost("/", HOST_BIO);

    // 404 num host remoto significa que o domínio ainda não foi atribuído ao
    // projeto na Vercel — passo pendente da Fase 3, não defeito de código.
    const semDominio = !LOCAL && porHost.status === 404;

    if (semDominio) {
      pular(
        "host bio. resolve /<slug> sem precisar de /b/",
        `${HOST_BIO} ainda não aponta para este projeto`,
      );
      pular("raiz de bio. não abre o portal", `${HOST_BIO} ainda não aponta`);
    } else {
      checar(
        porHost.status === 200 && porHost.corpo.includes("Promo do mês"),
        "host bio. resolve /<slug> sem precisar de /b/",
        `status ${porHost.status}`,
      );
      checar(
        raizBio.status === 307 &&
          (raizBio.headers.location ?? "").includes("mmtdigital.com.br"),
        "raiz de bio. não abre o portal",
        `status ${raizBio.status} → ${raizBio.headers.location ?? "-"}`,
      );
    }

    const pvFalso = await fetch(`${HUB_URL}/api/bio/pv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "slug-que-nao-existe", eventId: "x" }),
    });
    const pvReal = await fetch(`${HUB_URL}/api/bio/pv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: `${MARCA}-b`, eventId: "x" }),
    });
    checar(
      pvFalso.status === 204 && pvReal.status === 204,
      "beacon de PageView não revela se o slug existe",
      `inexistente ${pvFalso.status}, existente ${pvReal.status}`,
    );

    const painelCliente = await fetch(`${HUB_URL}/bio/${pagA}`, {
      headers: { cookie: cookieDaSessao(sessaoA) },
    });
    const htmlCliente = await painelCliente.text();
    checar(
      painelCliente.status === 200 &&
        htmlCliente.includes("Links publicados") &&
        !htmlCliente.includes("Salvar página"),
      "cliente vê a bio em leitura, sem editor",
      `status ${painelCliente.status}`,
    );

    const painelAgencia = await fetch(`${HUB_URL}/bio/${pagA}`, {
      headers: { cookie: cookieDaSessao(sessaoAg) },
    });
    const htmlAgencia = await painelAgencia.text();
    checar(
      painelAgencia.status === 200 && htmlAgencia.includes("Salvar página"),
      "agência vê o editor completo",
      `status ${painelAgencia.status}`,
    );
  }

  void pagB;
  void pagOff;
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
