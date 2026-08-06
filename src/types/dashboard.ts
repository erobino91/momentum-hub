/**
 * Formato dos dados do dashboard antigo (projeto Supabase `mynolirdauvkubxvlddt`),
 * já filtrado para o que o navegador pode ver.
 *
 * A RPC `get_public_dashboard` devolve também `client.id`, `client.slug` e
 * `period.client_id`. Nada disso entra aqui: o payload deste módulo vira props
 * de Client Component, ou seja, viaja no RSC e ficaria visível no DevTools —
 * e o slug é justamente o que dá acesso ao dashboard público antigo.
 */

export type SecaoDash =
  | "faturamento"
  | "salao"
  | "delivery"
  | "funil_cp"
  | "ifood"
  | "meta"
  | "google"
  | "crm";

export const SECOES_DASH: SecaoDash[] = [
  "faturamento",
  "salao",
  "delivery",
  "funil_cp",
  "ifood",
  "meta",
  "google",
  "crm",
];

export type ClienteDash = {
  nome: string;
  logoUrl: string | null;
  secoes: SecaoDash[];
};

/** Uma linha de `periods`. Numérico vem como `number` do jsonb; nulo é possível. */
export type PeriodoDash = {
  period_date: string;

  fat_mesa: number | null;
  fat_delivery: number | null;
  fat_ifood: number | null;
  pedidos_mesa: number | null;
  pedidos_delivery: number | null;

  cp_visitas: number | null;
  cp_views: number | null;
  cp_sacola: number | null;
  cp_revisao: number | null;
  cp_concluidos: number | null;

  if_visitas: number | null;
  if_views: number | null;
  if_sacola: number | null;
  if_revisao: number | null;
  if_concluidos: number | null;

  meta_invest: number | null;
  meta_vendas: number | null;
  google_invest: number | null;
  google_vendas: number | null;
  google_visitas_loja: number | null;
  google_rotas: number | null;
  crm_invest: number | null;
  crm_vendas: number | null;

  obs_raw: string | null;
  obs_polished: string | null;
};

export type DadosDashboard = {
  cliente: ClienteDash;
  /** Ordenados do mês mais antigo para o mais novo (ordem da RPC). */
  periodos: PeriodoDash[];
};

export type ChavePeriodo = keyof Omit<
  PeriodoDash,
  "period_date" | "obs_raw" | "obs_polished"
>;
