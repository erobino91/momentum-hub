import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ASAAS — a cobrança do hub vira PIX/boleto de verdade.
 *
 * O hub continua sendo a verdade: valor, reajuste e vencimento nascem aqui, e o
 * ASAAS só recebe a cobrança pronta. A volta é pelo webhook
 * (`/api/asaas/webhook`), que só sabe virar pendente em pago.
 *
 * Sem `ASAAS_API_KEY` nada disto roda e o financeiro funciona como na Fase 9.
 * A chave diz o ambiente: chave de sandbox tem `_hmlg_` no meio.
 *
 * **No `.env.local` a chave vai com `\$` no começo** — o Next expande `$algo`
 * como variável, e `$aact_...` viraria string vazia. Na Vercel não precisa.
 *
 * Sem imports `@/`: `verify-asaas.mjs` importa este arquivo direto no Node.
 */

export function asaasLigado() {
  return !!process.env.ASAAS_API_KEY;
}

type ErroAsaas = Error & { status?: number };

async function asaas<T>(caminho: string, metodo = "GET", corpo?: unknown): Promise<T> {
  const chave = process.env.ASAAS_API_KEY;
  if (!chave) throw new Error("ASAAS_API_KEY não configurada.");
  const base = chave.includes("_hmlg_")
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";

  const r = await fetch(base + caminho, {
    method: metodo,
    headers: {
      access_token: chave,
      "Content-Type": "application/json",
      // O ASAAS recusa chamada sem User-Agent em conta nova.
      "User-Agent": "momentum-hub",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store",
  });
  const json = await r.json().catch(() => null);
  if (!r.ok) {
    const erro: ErroAsaas = new Error(
      json?.errors?.[0]?.description ?? `ASAAS respondeu ${r.status}`,
    );
    erro.status = r.status;
    throw erro;
  }
  return json as T;
}

type Pagamento = {
  id: string;
  invoiceUrl: string;
  value: number;
  status: string;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  deleted?: boolean;
};

/** Status do ASAAS em que o dinheiro já entrou. */
const PAGO = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

/** Forma do contrato → `billingType`. O resto deixa o cliente escolher na fatura. */
const TIPO: Record<string, string> = {
  pix: "PIX",
  boleto: "BOLETO",
  cartao: "CREDIT_CARD",
};

type Contrato = {
  id: string;
  org_id: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  asaas_customer_id: string | null;
  forma_pagamento: string | null;
};

/**
 * O cliente no ASAAS: o já vinculado, senão o que já existe lá com o mesmo
 * CPF/CNPJ, senão um novo. Boa parte dos clientes já estava cadastrada no
 * ASAAS antes do hub — criar de novo duplicaria o cadastro deles.
 */
async function garantirCliente(db: SupabaseClient, c: Contrato, nome: string) {
  if (c.asaas_customer_id) return c.asaas_customer_id;

  const achado = await asaas<{ data: { id: string }[] }>(
    `/customers?cpfCnpj=${c.cpf_cnpj}`,
  );
  const id =
    achado.data[0]?.id ??
    (
      await asaas<{ id: string }>("/customers", "POST", {
        name: nome,
        cpfCnpj: c.cpf_cnpj,
        email: c.email ?? undefined,
        mobilePhone: c.telefone ?? undefined,
        externalReference: c.org_id,
      })
    ).id;

  await db.from("billing_contracts").update({ asaas_customer_id: id }).eq("id", c.id);
  return id;
}

/**
 * O pagamento que já existe no ASAAS para esta cobrança: o que o hub criou
 * (`externalReference` = id da cobrança) ou, senão, qualquer um do mesmo
 * cliente com vencimento no mesmo mês — assinatura que já rodava lá antes do
 * hub, ou cobrança avulsa feita no painel. Criar outro seria cobrar duas vezes.
 */
async function pagamentoDoMes(cobrancaId: string, cliente: string, competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  const fim = new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);

  const porRef = await asaas<{ data: Pagamento[] }>(
    `/payments?externalReference=${cobrancaId}`,
  );
  const lista = porRef.data.some((x) => !x.deleted)
    ? porRef.data
    : (
        await asaas<{ data: Pagamento[] }>(
          `/payments?customer=${cliente}&dueDate%5Bge%5D=${competencia}&dueDate%5Ble%5D=${fim}&limit=10`,
        )
      ).data;
  return lista.find((x) => !x.deleted && x.status !== "REFUNDED") ?? null;
}

/**
 * Manda ao ASAAS toda cobrança pendente do mês que ainda não foi.
 *
 * Idempotente como `gerar_cobrancas`: rodar de novo só pega o que falhou, e
 * `pagamentoDoMes` é conferido antes de criar — nem uma volta interrompida nem
 * uma assinatura antiga viram cobrança em dobro. Pagamento achado lá que já foi
 * pago marca a cobrança do hub como paga na hora: o webhook dele já passou.
 *
 * Cobrança vencida só se vincula, não se cria: o ASAAS não aceita vencimento no
 * passado, e mudar a data em silêncio seria cobrar num dia que ninguém combinou.
 */
export async function enviarCobrancas(db: SupabaseClient, mes: string, hoje: string) {
  const problemas: string[] = [];
  let enviadas = 0;

  const { data: cobrancas, error } = await db
    .from("billing_charges")
    .select("id, org_id, valor, vencimento, competencia, orgs(name)")
    .eq("competencia", mes)
    .eq("status", "pendente")
    .is("asaas_payment_id", null);
  if (error) throw error;
  if (!cobrancas?.length) return { enviadas, problemas };

  const { data: contratos } = await db
    .from("billing_contracts")
    .select("id, org_id, cpf_cnpj, email, telefone, asaas_customer_id, forma_pagamento")
    .in("org_id", cobrancas.map((c) => c.org_id))
    .returns<Contrato[]>();

  for (const ch of cobrancas) {
    const org = ch.orgs as unknown as { name: string } | null;
    const nome = org?.name ?? ch.org_id;
    const c = contratos?.find((x) => x.org_id === ch.org_id);

    if (!c || (!c.cpf_cnpj && !c.asaas_customer_id)) {
      problemas.push(`${nome}: sem CPF/CNPJ no contrato`);
      continue;
    }

    try {
      const cliente = await garantirCliente(db, c, nome);
      const existente = await pagamentoDoMes(ch.id, cliente, ch.competencia);
      if (!existente && ch.vencimento < hoje) {
        problemas.push(`${nome}: venceu em ${dataBR(ch.vencimento)}, cobrar à mão`);
        continue;
      }
      if (existente && Number(existente.value) !== Number(ch.valor)) {
        problemas.push(
          `${nome}: vinculado ao pagamento que já existia no ASAAS, de R$ ${existente.value} (o hub diz R$ ${ch.valor})`,
        );
      }

      const p =
        existente ??
        (await asaas<Pagamento>("/payments", "POST", {
          customer: cliente,
          billingType: TIPO[c.forma_pagamento ?? ""] ?? "UNDEFINED",
          value: Number(ch.valor),
          dueDate: ch.vencimento,
          description: `Mensalidade Momentum Digital ${ch.competencia.slice(5, 7)}/${ch.competencia.slice(0, 4)}`,
          externalReference: ch.id,
        }));

      const pagoEm = PAGO.includes(p.status)
        ? (p.paymentDate ?? p.confirmedDate ?? hoje)
        : null;
      const { error: e } = await db
        .from("billing_charges")
        .update({
          asaas_payment_id: p.id,
          asaas_url: p.invoiceUrl,
          ...(pagoEm ? { status: "pago", pago_em: pagoEm } : {}),
        })
        .eq("id", ch.id);
      if (e) throw e;
      enviadas++;
    } catch (e) {
      problemas.push(`${nome}: ${(e as Error).message}`);
    }
  }

  return { enviadas, problemas };
}

/** Apaga no ASAAS. Já apagado lá (404) é o resultado que se queria. */
export async function cancelarPagamento(id: string) {
  try {
    await asaas(`/payments/${id}`, "DELETE");
  } catch (e) {
    if ((e as ErroAsaas).status !== 404) throw e;
  }
}

/**
 * Pagamento marcado à mão no hub precisa existir no ASAAS também — senão ele
 * segue mandando lembrete de cobrança para quem já pagou.
 */
export function receberEmDinheiro(id: string, data: string, valor: number) {
  return asaas(`/payments/${id}/receiveInCash`, "POST", {
    paymentDate: data,
    value: valor,
    notifyCustomer: false,
  });
}

/** Só desfaz o que foi recebido à mão; pagamento que caiu pelo ASAAS ele recusa. */
export function desfazerRecebimento(id: string) {
  return asaas(`/payments/${id}/undoReceivedInCash`, "POST");
}

export type AcaoWebhook =
  | { tipo: "pago"; id: string; data: string }
  | { tipo: "desvincular"; id: string }
  | null;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * O que um evento do ASAAS muda no hub. Quase tudo é nada: o hub só quer saber
 * de dinheiro que entrou e de cobrança apagada lá.
 *
 * `CONFIRMED` (cartão aprovado) e `RECEIVED` (PIX/boleto compensado) viram pago
 * os dois — para a agência o cliente pagou no primeiro.
 */
export function lerEvento(corpo: unknown, hoje: string): AcaoWebhook {
  const ev = corpo as { event?: string; payment?: Record<string, unknown> } | null;
  const p = ev?.payment;
  if (!p || typeof p.id !== "string") return null;

  if (ev.event === "PAYMENT_RECEIVED" || ev.event === "PAYMENT_CONFIRMED") {
    const data = [p.paymentDate, p.confirmedDate, p.clientPaymentDate].find(
      (d): d is string => typeof d === "string" && DATA.test(d),
    );
    return { tipo: "pago", id: p.id, data: data ?? hoje };
  }
  if (ev.event === "PAYMENT_DELETED") return { tipo: "desvincular", id: p.id };
  return null;
}

function dataBR(iso: string) {
  return iso.split("-").reverse().join("/");
}
