/**
 * Aposenta o dashboard antigo (Fase 6).
 *
 *   node scripts/aposentar-dash-antigo.mjs             (relata)
 *   node scripts/aposentar-dash-antigo.mjs --aplicar
 *
 * Dois passos, nesta ordem:
 *
 *   1. `dash.mmtdigital.com.br` sai do projeto Vercel antigo e passa a ser um
 *      **redirect 308 para o portal**. Não é frescura de UX: os links do
 *      dashboard antigo estão espalhados em conversa de WhatsApp com cliente, e
 *      quem abrir um deles cai no login em vez de tomar 404 — dá para resolver o
 *      acesso na hora, um cliente por vez, em vez de criar todas as contas de
 *      uma vez antes de cortar.
 *   2. O projeto `dash` é apagado. O código continua no repo `dashboards`; o que
 *      ele servia (admin, periods, pricing, lives, dash) virou tela do hub.
 *
 * O projeto Supabase antigo não é tratado aqui: ele vive em outra conta, e o
 * token deste repo não o enxerga.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const aplicar = process.argv.includes("--aplicar");

const DOMINIO = "dash.mmtdigital.com.br";
const PROJETO_ANTIGO = "prj_CgixHtM4RxKJvZkCSbo2HiBaMyLb"; // dash
const PROJETO_HUB = "prj_YWCuvw0fPjFcdJNvlrq3M7AlSxpc"; // momentum-hub
const DESTINO = "portal.mmtdigital.com.br";

const token = readFileSync(join(raiz, ".vercel-token.txt"), "utf8").trim();
const api = (caminho, init = {}) =>
  fetch(`https://api.vercel.com${caminho}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const dominiosDe = async (projeto) => {
  const r = await api(`/v9/projects/${projeto}/domains`);
  return r.ok ? ((await r.json()).domains ?? []) : [];
};

const antes = await dominiosDe(PROJETO_ANTIGO);
console.log("projeto dash:", antes.map((d) => d.name).join(", ") || "(sem domínio)");
console.log("projeto hub :", (await dominiosDe(PROJETO_HUB)).map((d) => d.name).join(", "));

if (!aplicar) {
  console.log(`\nSeria feito: ${DOMINIO} -> redirect 308 para ${DESTINO}, e o projeto dash apagado.`);
  console.log("Para aplicar: node scripts/aposentar-dash-antigo.mjs --aplicar");
  process.exit(0);
}

// 1. tira o domínio do projeto antigo (um domínio vive em um projeto só)
if (antes.some((d) => d.name === DOMINIO)) {
  const r = await api(`/v9/projects/${PROJETO_ANTIGO}/domains/${DOMINIO}`, { method: "DELETE" });
  console.log(`remover ${DOMINIO} do projeto dash: ${r.status}`);
}

// 2. adiciona no hub como redirect
const add = await api(`/v10/projects/${PROJETO_HUB}/domains`, {
  method: "POST",
  body: JSON.stringify({ name: DOMINIO, redirect: DESTINO, redirectStatusCode: 308 }),
});
console.log(`apontar ${DOMINIO} -> ${DESTINO}: ${add.status}`);
if (!add.ok) {
  console.log((await add.text()).slice(0, 300));
  process.exit(1);
}

// 3. apaga o projeto antigo
const del = await api(`/v9/projects/${PROJETO_ANTIGO}`, { method: "DELETE" });
console.log(`apagar projeto dash: ${del.status}`);
if (!del.ok) console.log((await del.text()).slice(0, 300));

console.log("\nhub agora:", (await dominiosDe(PROJETO_HUB)).map((d) => d.name).join(", "));
