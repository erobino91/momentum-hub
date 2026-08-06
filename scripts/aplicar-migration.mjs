/**
 * Aplica uma migration no projeto `momentum-hub` pela API de gestão.
 *
 * A API devolve **400 sem corpo** quando recebe o arquivo inteiro de uma vez,
 * então o arquivo vai em pedaços, cortados nas linhas de comentário
 * `-- ------...` que separam as seções.
 *
 * Uso:  node scripts/aplicar-migration.mjs supabase/migrations/<arquivo>.sql
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Informe o caminho da migration.");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(join(raiz, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const TOKEN = readFileSync(join(raiz, ".supabase-token.txt"), "utf8").trim();

const sql = readFileSync(resolve(raiz, arquivo), "utf8");
const secoes = sql
  .split(/^-- -{10,}$/m)
  .map((s) => s.trim())
  .filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));

console.log(`${arquivo} → ${secoes.length} seções no projeto ${REF}\n`);

for (const [i, secao] of secoes.entries()) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: secao }),
    },
  );
  const corpo = await r.text();
  console.log(`  seção ${i + 1}/${secoes.length}: ${r.status}${r.ok ? "" : ` ${corpo.slice(0, 300)}`}`);
  if (!r.ok) process.exit(1);
}

console.log("\nMigration aplicada.");
