/**
 * Traz do ASAAS os dados dos clientes que já estavam cadastrados lá.
 *
 * Casa cada contrato do hub sem vínculo com um cliente do ASAAS pelo nome
 * (sem acento, caixa ou pontuação; um contido no outro também vale) e copia
 * CPF/CNPJ, e-mail, WhatsApp e o id do cliente. Quem não casar fica listado
 * para preencher à mão no contrato — cliente novo nasce no ASAAS pelo hub.
 *
 * Sem `--aplicar` só mostra o que faria.
 *
 * Uso:  node scripts/asaas-importar.mjs [--aplicar]
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

// No .env.local a chave vem como `\$aact_...` (ver src/lib/asaas.ts).
const CHAVE = (env.ASAAS_API_KEY ?? "").replace(/^\\/, "");
if (!CHAVE) {
  console.error("ASAAS_API_KEY não está no .env.local.");
  process.exit(1);
}
const BASE = CHAVE.includes("_hmlg_")
  ? "https://api-sandbox.asaas.com/v3"
  : "https://api.asaas.com/v3";
const APLICAR = process.argv.includes("--aplicar");

const SB = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_H = {
  apikey: env.SUPABASE_SECRET_KEY,
  Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
  "Content-Type": "application/json",
};

async function asaas(caminho) {
  const r = await fetch(BASE + caminho, {
    headers: { access_token: CHAVE, "User-Agent": "momentum-hub" },
  });
  if (!r.ok) throw new Error(`ASAAS ${r.status}: ${await r.text()}`);
  return r.json();
}

const clientes = [];
for (let offset = 0; ; offset += 100) {
  const pagina = await asaas(`/customers?limit=100&offset=${offset}`);
  clientes.push(...pagina.data.filter((c) => !c.deleted));
  if (!pagina.hasMore) break;
}

const r = await fetch(
  `${SB}/rest/v1/billing_contracts?select=id,situacao,cpf_cnpj,asaas_customer_id,orgs(name)&asaas_customer_id=is.null`,
  { headers: SB_H },
);
if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
const contratos = await r.json();

const norm = (s) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const oculto = (doc) => (doc ? `***${doc.slice(-4)}` : "—");

console.log(`${clientes.length} clientes no ASAAS, ${contratos.length} contratos sem vínculo.\n`);

const semPar = [];
for (const c of contratos) {
  const nome = c.orgs?.name ?? c.id;
  const n = norm(nome);
  // Por CPF/CNPJ primeiro, quando o contrato já tem; senão pelo nome.
  let achados = c.cpf_cnpj ? clientes.filter((x) => x.cpfCnpj === c.cpf_cnpj) : [];
  if (!achados.length) {
    achados = clientes.filter((x) => {
      const m = norm(x.name);
      const f = norm(x.company);
      return (
        m === n || f === n ||
        (n.length >= 4 && (m.includes(n) || n.includes(m) || (f && (f.includes(n) || n.includes(f)))))
      );
    });
  }

  if (achados.length !== 1) {
    semPar.push(`${nome} (${c.situacao})${achados.length > 1 ? ` — ${achados.length} candidatos: ${achados.map((x) => x.name).join(", ")}` : ""}`);
    continue;
  }

  const a = achados[0];
  const linha = {
    cpf_cnpj: (a.cpfCnpj ?? "").replace(/\D/g, "") || null,
    email: a.email || null,
    telefone: (a.mobilePhone || a.phone || "").replace(/\D/g, "") || null,
    asaas_customer_id: a.id,
  };
  console.log(`  ${nome}  →  ${a.name}  [${oculto(linha.cpf_cnpj)}]`);

  if (APLICAR) {
    const u = await fetch(`${SB}/rest/v1/billing_contracts?id=eq.${c.id}`, {
      method: "PATCH",
      headers: SB_H,
      body: JSON.stringify(linha),
    });
    if (!u.ok) console.log(`     FALHOU: ${await u.text()}`);
  }
}

if (semPar.length) {
  console.log(`\nSem par no ASAAS (preencher CPF/CNPJ no contrato):`);
  for (const s of semPar) console.log(`  ${s}`);
}
console.log(APLICAR ? "\nAplicado." : "\nNada gravado. Rode com --aplicar.");
