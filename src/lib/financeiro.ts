import { createClient } from "@/lib/supabase/server";
import { formatarDinheiro } from "@/lib/numero";
import type {
  FormaPagamento,
  SituacaoContrato,
  BillingCharge,
} from "@/types/db";

/** Uma linha de `agencia_financeiro(p_mes)`. */
export type LinhaFinanceiro = {
  org_id: string;
  name: string;
  slug: string;
  contrato_id: string | null;
  situacao: SituacaoContrato | null;
  dia_vencimento: number | null;
  forma_pagamento: FormaPagamento | null;
  cliente_desde: string | null;
  observacao: string | null;
  valor_vigente: number | null;
  cobranca_id: string | null;
  competencia: string | null;
  vencimento: string | null;
  valor: number | null;
  status: BillingCharge["status"] | null;
  pago_em: string | null;
  cobranca_obs: string | null;
};

export async function carregarFinanceiro(
  mes: string,
): Promise<LinhaFinanceiro[]> {
  const supabase = createClient();
  // Mesmo motivo de `carregarEmpresas`: `rpc()` sem tipos gerados devolve
  // `any`, e o `.returns<T[]>()` recusa array em função que ele não sabe ser
  // `setof`.
  const { data } = await supabase.rpc("agencia_financeiro", { p_mes: mes });
  return (data as LinhaFinanceiro[] | null) ?? [];
}

/**
 * O estado de uma linha do mês.
 *
 * **"Atrasado" nasce aqui e em nenhum outro lugar.** Não existe status
 * `atrasado` no banco de propósito: gravado, ele envelheceria calado — ninguém
 * roda o job que viraria pendente em atrasado, e a tela passaria a mentir.
 * Quem precisar do estado chama esta função, para tela e relatório não
 * discordarem.
 */
export type EstadoCobranca =
  | "pago"
  | "atrasado"
  | "pendente"
  | "cancelado"
  | "nao-gerada"
  | "sem-contrato";

export function estadoCobranca(
  linha: LinhaFinanceiro,
  hoje = hojeISO(),
): EstadoCobranca {
  if (!linha.contrato_id) return "sem-contrato";
  if (!linha.cobranca_id || !linha.status) return "nao-gerada";
  if (linha.status === "pago") return "pago";
  if (linha.status === "cancelado") return "cancelado";
  // Comparação de texto porque as duas datas são `YYYY-MM-DD`: ordem
  // alfabética e ordem cronológica coincidem, e não há fuso para errar.
  return linha.vencimento && linha.vencimento < hoje ? "atrasado" : "pendente";
}

/** Só o que conta como dinheiro a receber: pendente e atrasado. */
export function emAberto(estado: EstadoCobranca) {
  return estado === "pendente" || estado === "atrasado";
}

const ROTULO: Record<EstadoCobranca, string> = {
  pago: "pago",
  atrasado: "atrasado",
  pendente: "em aberto",
  cancelado: "cancelado",
  "nao-gerada": "não gerada",
  "sem-contrato": "sem contrato",
};

export function rotuloEstado(estado: EstadoCobranca) {
  return ROTULO[estado];
}

/** Quantos dias de atraso. Zero ou negativo quer dizer que ainda não venceu. */
export function diasDeAtraso(vencimento: string, hoje = hojeISO()) {
  const ms =
    new Date(`${hoje}T00:00:00Z`).getTime() -
    new Date(`${vencimento}T00:00:00Z`).getTime();
  return Math.floor(ms / 86_400_000);
}

/**
 * Dinheiro **com** centavos. O `reaisCurtos` de `agencia.ts` arredonda de
 * propósito — em lista de faturamento, centavo é ruído. Aqui não: o valor é o
 * que o cliente deve, e boleto de R$ 1.499,90 não é R$ 1.500.
 */
export function reais(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "—";
  return `R$ ${formatarDinheiro(Number(valor))}`;
}

/** `2026-08-25` de hoje, em UTC, para comparar com data do banco. */
export function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

/** O mês corrente como `2026-08-01`. */
export function mesCorrente() {
  return `${hojeISO().slice(0, 7)}-01`;
}

/** `2026-08-01` + n meses. `n` negativo anda para trás. */
export function deslocarMes(mes: string, n: number) {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(ano, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** `2026-08-01` → `25/08/2026`. Vazio vira travessão. */
export function dataCurta(iso: string | null) {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export const FORMAS: { valor: FormaPagamento; rotulo: string }[] = [
  { valor: "pix", rotulo: "PIX" },
  { valor: "boleto", rotulo: "Boleto" },
  { valor: "cartao", rotulo: "Cartão" },
  { valor: "transferencia", rotulo: "Transferência" },
  { valor: "outro", rotulo: "Outro" },
];

export function rotuloForma(forma: FormaPagamento | null) {
  return FORMAS.find((f) => f.valor === forma)?.rotulo ?? "—";
}

export const SITUACOES: { valor: SituacaoContrato; rotulo: string }[] = [
  { valor: "ativo", rotulo: "Ativo" },
  { valor: "pausado", rotulo: "Pausado" },
  { valor: "encerrado", rotulo: "Encerrado" },
];
