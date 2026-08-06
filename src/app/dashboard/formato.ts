/**
 * Formatação e cálculo de variação — cópia fiel do que o `dash.html` faz, para
 * o número no portal bater com o número do dashboard antigo.
 */

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function n(v: unknown): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

export function fmtBRL(v: unknown): string {
  return `R$ ${n(v).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtNum(v: unknown): string {
  return Math.round(n(v)).toLocaleString("pt-BR");
}

export function fmtPct(v: number): string {
  return `${v.toFixed(1).replace(".", ",")}%`;
}

/** O `T12:00:00` evita o dia virar por fuso — mesmo truque do dash.html. */
export function fmtMes(data: string): string {
  const dt = new Date(`${data}T12:00:00`);
  return `${MESES[dt.getMonth()]} de ${dt.getFullYear()}`;
}

export function fmtMesCurto(data: string): string {
  const dt = new Date(`${data}T12:00:00`);
  return `${MESES_CURTOS[dt.getMonth()]}/${String(dt.getFullYear()).slice(2)}`;
}

export type Variacao = { pct: number; subiu: boolean } | null;

/** `null` quando não há mês anterior com base positiva — vira "—" na tela. */
export function variacao(atual: unknown, anterior: unknown): Variacao {
  const a = n(anterior);
  if (!(a > 0)) return null;
  const d = ((n(atual) - a) / a) * 100;
  return { pct: d, subiu: d >= 0 };
}

export function textoVariacao(v: Variacao): string {
  if (!v) return "—";
  const sinal = v.subiu ? "+" : "";
  return `${v.subiu ? "↑" : "↓"} ${sinal}${v.pct
    .toFixed(1)
    .replace(".", ",")} % vs mês anterior`;
}

/** Divisão que devolve 0 em vez de Infinity quando não há base. */
export function razao(numerador: unknown, denominador: unknown): number {
  const d = n(denominador);
  return d > 0 ? n(numerador) / d : 0;
}

export function fmtRoas(v: number): string {
  return v > 0 ? `${v.toFixed(1).replace(".", ",")}x` : "—";
}
