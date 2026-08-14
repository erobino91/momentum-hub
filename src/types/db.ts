import type { ModuleKey } from "@/lib/modules";

export type MembershipRole = "owner" | "staff" | "agency";

export type Org = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
};

export type Membership = {
  id: string;
  user_id: string;
  org_id: string;
  role: MembershipRole;
  created_at: string;
};

/**
 * Configuração de um módulo para uma empresa. **Não é liberação de acesso** —
 * todo cliente tem todos os módulos. Um módulo aparece pronto quando o recurso
 * dele existe, o que quem responde é `modulos_configurados()`, não uma coluna
 * aqui.
 */
export type ModuleConfig = {
  id: string;
  org_id: string;
  module: ModuleKey;
  config: Record<string, unknown>;
};

/** O que `modulos_configurados(org)` devolve. */
export type ModulosConfigurados = {
  dashboard: boolean;
  bio: boolean;
  fila: boolean;
};

/**
 * Um mês de resultado de uma empresa. Chegou na Fase 6, vindo da tabela
 * `periods` do projeto antigo do dashboard.
 */
export type DashboardPeriod = {
  id: string;
  org_id: string;
  period_date: string;
  fat_total: number | null;
  fat_proprio: number | null;
  fat_ifood: number | null;
  fat_mesa: number | null;
  fat_delivery: number | null;
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

export type PricingProduct = {
  id: string;
  org_id: string;
  name: string;
  preco_balcao: number;
  created_at: string;
};

/** `taxa_extra` em %, os outros três em R$ — unidades herdadas do projeto antigo. */
export type PricingConfig = {
  id: string;
  org_id: string;
  taxa_extra: number;
  campanha: number;
  entrega: number;
  cupom: number;
};

export type LiveMaterial = {
  id: string;
  org_id: string;
  label: string;
  source_url: string;
  file_url: string | null;
  status: "processing" | "ready" | "error";
  created_at: string;
};

/** `stream_key` é segredo: não sai para Client Component. */
export type LiveSession = {
  id: string;
  org_id: string;
  material_id: string | null;
  stream_url: string | null;
  status: "starting" | "live" | "ending" | "ended" | "error";
  started_at: string | null;
  ended_at: string | null;
  auto_cutoff_at: string | null;
  error_message: string | null;
  created_at: string;
};

