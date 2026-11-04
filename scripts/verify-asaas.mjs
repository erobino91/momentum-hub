/**
 * Verificação do ASAAS — o que um evento do webhook muda no hub.
 *
 * O webhook é a única porta por onde o ASAAS escreve no financeiro, então a
 * regra de `lerEvento` é o que decide se dinheiro aparece como recebido. Não
 * chama o ASAAS nem o banco.
 *
 * Uso:  node scripts/verify-asaas.mjs
 */

import assert from "node:assert/strict";

const { lerEvento } = await import("../src/lib/asaas.ts");
const HOJE = "2026-11-04";
const ev = (event, payment) => lerEvento({ event, payment }, HOJE);

// PIX/boleto compensado e cartão aprovado: pago, com a data do pagamento.
assert.deepEqual(ev("PAYMENT_RECEIVED", { id: "pay_1", paymentDate: "2026-11-03" }), {
  tipo: "pago", id: "pay_1", data: "2026-11-03",
});
assert.deepEqual(ev("PAYMENT_CONFIRMED", { id: "pay_2", paymentDate: null, confirmedDate: "2026-11-02" }), {
  tipo: "pago", id: "pay_2", data: "2026-11-02",
});
// Sem data utilizável, vale hoje — pago sem data o banco recusa.
assert.equal(ev("PAYMENT_RECEIVED", { id: "pay_3", paymentDate: "lixo" }).data, HOJE);

// Apagado lá: só solta o vínculo.
assert.deepEqual(ev("PAYMENT_DELETED", { id: "pay_4" }), { tipo: "desvincular", id: "pay_4" });

// O resto não mexe em nada: vencido, criado, estorno, desfazer recebimento.
for (const e of ["PAYMENT_OVERDUE", "PAYMENT_CREATED", "PAYMENT_REFUNDED", "PAYMENT_RECEIVED_IN_CASH_UNDONE"]) {
  assert.equal(ev(e, { id: "pay_5" }), null, e);
}

// Corpo torto não vira escrita.
assert.equal(lerEvento(null, HOJE), null);
assert.equal(lerEvento({ event: "PAYMENT_RECEIVED" }, HOJE), null);
assert.equal(lerEvento({ event: "PAYMENT_RECEIVED", payment: { id: 7 } }, HOJE), null);

console.log("  ok   verify:asaas — eventos do webhook");
