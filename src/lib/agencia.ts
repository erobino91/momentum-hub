import { createClient } from "@/lib/supabase/server";

/** Uma linha de `agencia_empresas()`. */
export type EmpresaPainel = {
  id: string;
  name: string;
  slug: string;
  dashboard: boolean;
  bio: boolean;
  fila: boolean;
  acessos: number;
  meses: number;
  ultimo_mes: string | null;
  ultimo_faturamento: number | null;
  produtos: number;
};

export type AcessoPainel = {
  user_id: string;
  email: string;
  role: string;
  desde: string;
  ultimo_acesso: string | null;
};

export async function carregarEmpresas(): Promise<EmpresaPainel[]> {
  const supabase = createClient();
  // `rpc()` sem tipos gerados devolve `any`; o `.returns<T[]>()` do supabase-js
  // recusa array em função que ele não sabe ser `setof`, então o tipo entra aqui.
  const { data } = await supabase.rpc("agencia_empresas");
  return (data as EmpresaPainel[] | null) ?? [];
}

export async function carregarAcessos(orgId: string): Promise<AcessoPainel[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc("agencia_acessos", { p_org: orgId });
  return (data as AcessoPainel[] | null) ?? [];
}

/**
 * O fechamento está atrasado?
 *
 * O mês só fecha depois de terminar, então em agosto o esperado é ter julho
 * publicado. Atrasado é ficar para trás disso. Empresa sem nenhum mês não é
 * "atrasada" — é "em configuração", que é outro estado e tem outra saída.
 */
export function mesAtrasado(ultimoMes: string | null, hoje = new Date()) {
  if (!ultimoMes) return false;
  const esperado = new Date(
    Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1),
  );
  return new Date(`${ultimoMes}T00:00:00Z`) < esperado;
}

/** `2026-07-01` → `jul/26`. Cabe em coluna de tabela. */
export function mesCurto(data: string | null) {
  if (!data) return "—";
  const nomes = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  const [ano, mes] = data.split("-");
  return `${nomes[Number(mes) - 1] ?? mes}/${ano.slice(2)}`;
}

/** Dinheiro sem centavos — em lista, centavo é ruído. */
export function reaisCurtos(valor: number | null) {
  if (valor === null || valor === undefined) return "—";
  return `R$ ${Math.round(Number(valor)).toLocaleString("pt-BR")}`;
}

/**
 * Iniciais para o quadradinho da lista. Só letras e números contam — senão
 * "S-HOUSE" vira "S-", que não é inicial de nada.
 */
export function iniciais(nome: string) {
  const partes = nome
    // Sem `\p{L}` e sem a flag `u`: o `target` do projeto é anterior ao ES6.
    .replace(/[^0-9A-Za-zÀ-ɏ\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[1][0]).toUpperCase();
}
