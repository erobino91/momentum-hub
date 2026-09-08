/**
 * Data e hora no fuso em que a agência opera.
 *
 * O problema que este arquivo existe para resolver aparece só em produção: a
 * Vercel roda em **UTC**. Toda hora renderizada no servidor sem fuso explícito
 * sai três horas adiantada, e todo "hoje" calculado com `toISOString()` vira o
 * dia seguinte a partir das 21h. Nada disso dá erro — a tela só mostra outro
 * número, e em local (onde a máquina já é BRT) tudo parece certo.
 *
 * **Zona IANA, não offset fixo.** `America/Sao_Paulo` é −03:00 hoje porque o
 * Brasil acabou com o horário de verão em 2019. Se voltar, a zona acompanha
 * sozinha; um `-03:00` cravado no código passaria a errar uma hora por alguns
 * meses do ano, calado.
 */
export const FUSO = "America/Sao_Paulo";

/**
 * A data de hoje (`2026-09-04`) no fuso da agência.
 *
 * Montada peça a peça de propósito: `toISOString().slice(0, 10)` devolve o dia
 * em UTC — depois das 21h em Brasília, já é amanhã. Isso decidia atraso de
 * cobrança e chegava a marcar como vencida uma conta que ainda tinha o dia
 * inteiro pela frente.
 *
 * `formatToParts` em vez de um locale que por acaso formata como ISO: assim o
 * resultado não depende de qual locale a plataforma resolveu embutir.
 */
export function hojeISO(): string {
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const pegar = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value ?? "";

  return `${pegar("year")}-${pegar("month")}-${pegar("day")}`;
}

/** Instante → `19:00`, no fuso da agência. */
export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Instante → `04/09 19:00`. Com o dia junto, para o que pode ser amanhã. */
export function dataEHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Instante → `04/09/26`. Para coluna de tabela, onde a hora não cabe. */
export function diaCurto(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Dois `timestamptz` que valem o mesmo instante. Comparar as strings cruas não
 * serve: `+00:00` e `.000Z` são o mesmo momento escrito de dois jeitos, e quem
 * escreve cada coluna costuma ser um processo diferente.
 */
export function mesmoInstante(
  a: string | null,
  b: string | null,
): boolean {
  return Boolean(a && b && new Date(a).getTime() === new Date(b).getTime());
}
