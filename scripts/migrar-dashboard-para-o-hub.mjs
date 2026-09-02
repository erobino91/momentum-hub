/**
 * Fase 6 — copia o projeto antigo do dashboard (`mynolirdauvkubxvlddt`) para o
 * `momentum-hub`.
 *
 *   node scripts/migrar-dashboard-para-o-hub.mjs             (só relata)
 *   node scripts/migrar-dashboard-para-o-hub.mjs --aplicar
 *
 * Duas pontas explícitas (`origem` e `destino` abaixo) pelo mesmo motivo do
 * `migrate-to-hub.mjs` do Fila: o caminho de volta precisa existir enquanto o
 * projeto antigo estiver de pé.
 *
 * **Idempotente por id.** Cada linha copiada mantém o UUID que tinha no projeto
 * antigo, então rodar de novo é `upsert` no mesmo registro, não duplicata. Isso
 * também deixa o de-para auditável: o mesmo id existe dos dois lados.
 *
 * O que NÃO vem: `clients.is_active` (no hub quem não deve ver o dashboard é
 * quem não tem membership) e `profiles` (identidade agora é do hub).
 *
 * Credenciais saem de disco — `dashboard-agencia/lives-worker/.env` (origem) e
 * `momentum-hub/.env.local` (destino). Nada é impresso.
 *
 * **Gasto: não roda mais.** A Fase 6 já copiou tudo. O `.env` de origem morava no worker
 * das lives, que virou `momentum-hub/worker/` na limpeza de set/26 — e mesmo antes disso ele
 * já tinha sido repontado para o projeto do hub, então `origem` e `destino` seriam o mesmo
 * lugar. Fica no repo como registro de o que foi copiado e sob que regra; para rodar de novo
 * seria preciso repor a credencial do projeto antigo, que não está em disco em lugar nenhum.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const aplicar = process.argv.includes("--aplicar");

const lerEnv = (arquivo, chave) => {
  const v = readFileSync(arquivo, "utf8").match(
    new RegExp(`^${chave}=(.*)$`, "m"),
  )?.[1];
  if (!v) throw new Error(`${chave} não encontrada em ${arquivo}`);
  return v.trim();
};

const ENV_WORKER = join(raiz, "..", "dashboard-agencia", "lives-worker", ".env");
const ENV_HUB = join(raiz, ".env.local");

const origem = {
  url: lerEnv(ENV_WORKER, "SUPABASE_URL"),
  chave: lerEnv(ENV_WORKER, "SUPABASE_SERVICE_ROLE"),
};
const destino = {
  url: lerEnv(ENV_HUB, "NEXT_PUBLIC_SUPABASE_URL"),
  chave: lerEnv(ENV_HUB, "SUPABASE_SECRET_KEY"),
};

const cab = ({ chave }) => ({
  apikey: chave,
  Authorization: `Bearer ${chave}`,
  "Content-Type": "application/json",
});

async function ler(lado, caminho) {
  const r = await fetch(`${lado.url}/rest/v1/${caminho}`, { headers: cab(lado) });
  if (!r.ok) throw new Error(`GET ${caminho}: ${r.status} ${await r.text()}`);
  return r.json();
}

async function gravar(lado, tabela, linhas, conflito = "id") {
  if (!linhas.length) return 0;
  const r = await fetch(
    `${lado.url}/rest/v1/${tabela}?on_conflict=${conflito}`,
    {
      method: "POST",
      headers: {
        ...cab(lado),
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(linhas),
    },
  );
  if (!r.ok) throw new Error(`POST ${tabela}: ${r.status} ${await r.text()}`);
  return (await r.json()).length;
}

const passo = (texto) => console.log(`\n── ${texto}`);
const item = (texto) => console.log(`   ${texto}`);

// ── 1. clients -> orgs ──────────────────────────────────────────────────────
passo("empresas");

const clientes = await ler(origem, "clients?select=*&order=name");
const orgs = await ler(destino, "orgs?select=id,name,slug,logo_url");
const configs = await ler(
  destino,
  "module_config?select=org_id,config&module=eq.dashboard",
);

const slugConfigurado = new Map(
  configs
    .filter((c) => c.config?.dashboard_slug)
    .map((c) => [c.config.dashboard_slug, c.org_id]),
);

/** old client.id -> hub org.id */
const paraOrg = new Map();
const orgsNovas = [];

for (const cliente of clientes) {
  const jaLigada =
    slugConfigurado.get(cliente.slug) ??
    orgs.find((o) => o.slug === cliente.slug)?.id;

  if (jaLigada) {
    paraOrg.set(cliente.id, jaLigada);
    item(`${cliente.name} → org existente`);
    continue;
  }
  orgsNovas.push(cliente);
  item(`${cliente.name} → org nova (slug ${cliente.slug})`);
}

if (aplicar && orgsNovas.length) {
  const criadas = await fetch(`${destino.url}/rest/v1/orgs`, {
    method: "POST",
    headers: { ...cab(destino), Prefer: "return=representation" },
    body: JSON.stringify(
      orgsNovas.map((c) => ({ name: c.name, slug: c.slug })),
    ),
  });
  if (!criadas.ok) throw new Error(`criar orgs: ${await criadas.text()}`);
  const linhas = await criadas.json();
  for (const nova of linhas) {
    const cliente = orgsNovas.find((c) => c.slug === nova.slug);
    paraOrg.set(cliente.id, nova.id);
  }
  // Uma linha de config por módulo, como `criarOrg` faz na área da agência.
  await gravar(
    destino,
    "module_config",
    linhas.flatMap((o) =>
      ["dashboard", "bio", "fila", "cmv"].map((m) => ({
        org_id: o.id,
        module: m,
      })),
    ),
    "org_id,module",
  );
}

// ── 2. arquivos ─────────────────────────────────────────────────────────────
passo("arquivos (buckets logos e materials)");

/**
 * Lista recursiva. O `materials` tem três níveis
 * (`<material>/raw/arquivo.mp4`, `<material>/ready/arquivo.mp4`): parar em dois
 * deixa para trás justamente os vídeos convertidos, que é o que o worker
 * transmite. Pasta vem com `id: null`.
 */
async function listarArquivos(bucket, prefix = "", nivel = 0) {
  const r = await fetch(`${origem.url}/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: cab(origem),
    body: JSON.stringify({ prefix, limit: 500 }),
  });
  if (!r.ok) return [];

  const saida = [];
  for (const item of await r.json()) {
    const caminho = prefix + item.name;
    if (item.id === null) {
      if (nivel < 4) saida.push(...(await listarArquivos(bucket, `${caminho}/`, nivel + 1)));
    } else {
      saida.push(caminho);
    }
  }
  return saida;
}

const arquivos = {
  logos: await listarArquivos("logos"),
  materials: await listarArquivos("materials"),
};

for (const [bucket, lista] of Object.entries(arquivos)) {
  item(`${bucket}: ${lista.length} arquivo(s)`);
  if (!aplicar) continue;

  for (const caminho of lista) {
    const baixado = await fetch(
      `${origem.url}/storage/v1/object/${bucket}/${caminho}`,
      { headers: { apikey: origem.chave, Authorization: `Bearer ${origem.chave}` } },
    );
    if (!baixado.ok) {
      item(`   ${caminho}: FALHA ao baixar (${baixado.status})`);
      continue;
    }
    const corpo = Buffer.from(await baixado.arrayBuffer());
    const enviado = await fetch(
      `${destino.url}/storage/v1/object/${bucket}/${caminho}`,
      {
        method: "POST",
        headers: {
          apikey: destino.chave,
          Authorization: `Bearer ${destino.chave}`,
          "Content-Type": baixado.headers.get("content-type") ?? "application/octet-stream",
          "x-upsert": "true",
        },
        body: corpo,
      },
    );
    item(
      `   ${caminho} — ${(corpo.length / 1048576).toFixed(1)} MB — ${enviado.ok ? "ok" : `FALHA ${enviado.status}`}`,
    );
  }
}

/** URL de arquivo do projeto antigo reescrita para o hub. */
function reapontar(url) {
  if (!url) return null;
  const i = url.indexOf("/storage/v1/object/");
  return i === -1 ? url : destino.url + url.slice(i);
}

/**
 * Caminho dentro do bucket `materials`, sem host.
 *
 * O bucket nasce privado no hub, então URL pública não serve para nada: quem lê
 * (worker e painel) monta URL assinada na hora. Guardar o caminho é guardar a
 * única parte que não expira.
 */
function caminhoNoBucket(url) {
  if (!url) return null;
  return url.replace(
    /^https?:\/\/[^/]+\/storage\/v1\/object\/(public\/)?materials\//,
    "",
  );
}

// ── 3. logo da empresa ──────────────────────────────────────────────────────
passo("logo das empresas");

const logos = clientes
  .filter((c) => c.logo_url && paraOrg.get(c.id))
  .map((c) => ({ id: paraOrg.get(c.id), logo_url: reapontar(c.logo_url) }));
item(`${logos.length} logo(s) a repontar`);
if (aplicar) {
  for (const l of logos) {
    await fetch(`${destino.url}/rest/v1/orgs?id=eq.${l.id}`, {
      method: "PATCH",
      headers: cab(destino),
      body: JSON.stringify({ logo_url: l.logo_url }),
    });
  }
}

// ── 4. seções ativas do dashboard ───────────────────────────────────────────
passo("seções ativas (clients.active_sections -> module_config.config.secoes)");

const secoes = clientes.filter((c) => c.active_sections && paraOrg.get(c.id));
item(`${secoes.length} empresa(s) com seções configuradas`);
if (aplicar) {
  for (const c of secoes) {
    const orgId = paraOrg.get(c.id);
    const atual = configs.find((x) => x.org_id === orgId)?.config ?? {};
    await gravar(
      destino,
      "module_config",
      [
        {
          org_id: orgId,
          module: "dashboard",
          config: { ...atual, secoes: c.active_sections },
        },
      ],
      "org_id,module",
    );
  }
}

// ── 5. períodos ─────────────────────────────────────────────────────────────
passo("períodos");

const COLUNAS_PERIODO = [
  "fat_total", "fat_proprio", "fat_ifood", "fat_mesa", "fat_delivery",
  "pedidos_mesa", "pedidos_delivery",
  "cp_visitas", "cp_views", "cp_sacola", "cp_revisao", "cp_concluidos",
  "if_visitas", "if_views", "if_sacola", "if_revisao", "if_concluidos",
  "meta_invest", "meta_vendas", "google_invest", "google_vendas",
  "google_visitas_loja", "google_rotas", "crm_invest", "crm_vendas",
  "obs_raw", "obs_polished",
];

const periodos = await ler(origem, "periods?select=*");
const periodosProntos = periodos
  .filter((p) => paraOrg.get(p.client_id))
  .map((p) => {
    const linha = {
      id: p.id,
      org_id: paraOrg.get(p.client_id),
      period_date: p.period_date,
      created_at: p.created_at,
    };
    for (const c of COLUNAS_PERIODO) linha[c] = p[c] ?? null;
    return linha;
  });

item(`${periodosProntos.length} de ${periodos.length} períodos com empresa mapeada`);
if (aplicar) item(`gravados: ${await gravar(destino, "dashboard_periods", periodosProntos)}`);

// ── 6. precificação ─────────────────────────────────────────────────────────
passo("precificação");

const produtos = (await ler(origem, "pricing_products?select=*"))
  .filter((p) => paraOrg.get(p.client_id))
  .map((p) => ({
    id: p.id,
    org_id: paraOrg.get(p.client_id),
    name: p.name,
    preco_balcao: p.preco_balcao,
    created_at: p.created_at,
  }));

const configsPreco = (await ler(origem, "pricing_config?select=*"))
  .filter((c) => paraOrg.get(c.client_id))
  .map((c) => ({
    id: c.id,
    org_id: paraOrg.get(c.client_id),
    taxa_extra: c.taxa_extra ?? 0,
    campanha: c.campanha ?? 0,
    entrega: c.entrega ?? 0,
    cupom: c.cupom ?? 0,
  }));

item(`${produtos.length} produtos, ${configsPreco.length} configurações`);
if (aplicar) {
  item(`produtos gravados: ${await gravar(destino, "pricing_products", produtos)}`);
  item(`configs gravadas: ${await gravar(destino, "pricing_config", configsPreco)}`);
}

// ── 7. lives ────────────────────────────────────────────────────────────────
passo("lives");

const usuariosHub = await (async () => {
  const r = await fetch(`${destino.url}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: destino.chave, Authorization: `Bearer ${destino.chave}` },
  });
  return new Set(((await r.json()).users ?? []).map((u) => u.id));
})();

const materiais = (await ler(origem, "client_materials?select=*"))
  .filter((m) => paraOrg.get(m.client_id))
  .map((m) => ({
    id: m.id,
    org_id: paraOrg.get(m.client_id),
    label: m.label,
    source_url: caminhoNoBucket(m.source_url),
    file_url: caminhoNoBucket(m.file_url),
    status: m.status,
    created_at: m.created_at,
  }));

const sessoes = (await ler(origem, "live_sessions?select=*"))
  .filter((s) => paraOrg.get(s.client_id))
  .map((s) => ({
    id: s.id,
    org_id: paraOrg.get(s.client_id),
    material_id: s.material_id,
    stream_url: s.stream_url,
    stream_key: s.stream_key,
    status: s.status,
    started_at: s.started_at,
    ended_at: s.ended_at,
    auto_cutoff_at: s.auto_cutoff_at,
    error_message: s.error_message,
    // O `created_by` do projeto antigo aponta para o `auth.users` de lá. Só
    // sobrevive se o mesmo id existir aqui; senão vira histórico sem autor.
    created_by: usuariosHub.has(s.created_by) ? s.created_by : null,
    created_at: s.created_at,
  }));

item(`${materiais.length} materiais, ${sessoes.length} sessões`);
if (aplicar) {
  item(`materiais gravados: ${await gravar(destino, "live_materials", materiais)}`);
  item(`sessões gravadas: ${await gravar(destino, "live_sessions", sessoes)}`);
}

console.log(
  aplicar
    ? "\nMigração aplicada. Conferir com: npm run verify:fase6"
    : "\nNada foi escrito. Para aplicar: node scripts/migrar-dashboard-para-o-hub.mjs --aplicar",
);
