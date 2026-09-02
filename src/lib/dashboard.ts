import { createClient } from "@/lib/supabase/server";
import {
  SECOES_DASH,
  type DadosDashboard,
  type PeriodoDash,
  type SecaoDash,
} from "@/types/dashboard";

/**
 * Busca do dashboard, **sempre no servidor**.
 *
 * Até a Fase 5 isto era um `fetch` para a RPC `get_public_dashboard` do projeto
 * antigo, com o slug do cliente fazendo as vezes de senha. Na Fase 6 os números
 * passaram a morar em `dashboard_periods` aqui mesmo, e o que separa uma
 * empresa da outra é a RLS — não um slug que ninguém pode descobrir.
 *
 * O payload continua montado campo a campo: ele vira prop de Client Component e
 * viaja no RSC, então a linha crua (com `id` e `org_id`) não sai daqui.
 */

export type FalhaDashboard =
  | "sem-sessao"
  | "sem-org"
  | "sem-dados"
  | "erro";

export type ResultadoDashboard =
  | { ok: true; dados: DadosDashboard }
  | { ok: false; motivo: FalhaDashboard };

const CAMPOS_NUM = [
  "fat_mesa",
  "fat_delivery",
  "fat_ifood",
  "pedidos_mesa",
  "pedidos_delivery",
  "cp_visitas",
  "cp_views",
  "cp_sacola",
  "cp_revisao",
  "cp_concluidos",
  "if_visitas",
  "if_views",
  "if_sacola",
  "if_revisao",
  "if_concluidos",
  "meta_invest",
  "meta_vendas",
  "google_invest",
  "google_vendas",
  "google_visitas_loja",
  "google_rotas",
  "crm_invest",
  "crm_vendas",
] as const;

/** Colunas pedidas ao PostgREST — a lista existe para não vir `select=*`. */
const COLUNAS = [
  "period_date",
  ...CAMPOS_NUM,
  "obs_raw",
  "obs_polished",
].join(",");

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function limparPeriodo(linha: Record<string, unknown>): PeriodoDash | null {
  const data = texto(linha.period_date);
  if (!data) return null;

  const saida = { period_date: data } as PeriodoDash;
  for (const campo of CAMPOS_NUM) saida[campo] = num(linha[campo]);
  saida.obs_raw = texto(linha.obs_raw);
  saida.obs_polished = texto(linha.obs_polished);
  return saida;
}

/**
 * @param orgIdAlvo só é aceito de quem tem papel `agency` — serve para a agência
 * conferir o dashboard de um cliente sem trocar de conta.
 */
export async function carregarDashboard(
  orgIdAlvo?: string,
): Promise<ResultadoDashboard> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, motivo: "sem-sessao" };

  let orgId: string | null = null;
  if (orgIdAlvo) {
    const { data: ehAgencia } = await supabase.rpc("is_agency");
    if (!ehAgencia) return { ok: false, motivo: "sem-org" };
    orgId = orgIdAlvo;
  } else {
    const { data: membership } = await supabase
      .from("memberships")
      .select("org_id")
      .eq("user_id", user.id)
      .order("created_at")
      .limit(1)
      .maybeSingle<{ org_id: string }>();
    orgId = membership?.org_id ?? null;
  }
  if (!orgId) return { ok: false, motivo: "sem-org" };

  // Nome e logo saem de `orgs`; antes vinham de `clients` do projeto antigo.
  const { data: org, error: erroOrg } = await supabase
    .from("orgs")
    .select("name,logo_url")
    .eq("id", orgId)
    .maybeSingle<{ name: string; logo_url: string | null }>();
  if (erroOrg) return { ok: false, motivo: "erro" };
  if (!org) return { ok: false, motivo: "sem-org" };

  // A RLS de `dashboard_periods` já barra org alheia — o `.eq` é para a agência,
  // que enxerga todas e precisa escolher uma.
  // `publicado` é o que separa o mês fechado do rascunho que o sincronizador do
  // Meta cria no dia 1: sem este filtro o cliente veria o mês em construção com
  // faturamento R$ 0,00 e queda de 100%, porque `n()` lê nulo como zero.
  const { data: linhas, error } = await supabase
    .from("dashboard_periods")
    .select(COLUNAS)
    .eq("org_id", orgId)
    .eq("publicado", true)
    .order("period_date")
    .returns<Record<string, unknown>[]>();
  if (error) return { ok: false, motivo: "erro" };

  const periodos = (linhas ?? [])
    .map(limparPeriodo)
    .filter((p): p is PeriodoDash => p !== null);
  if (periodos.length === 0) return { ok: false, motivo: "sem-dados" };

  // Quais blocos o cliente vê. Sem configuração, vê todos.
  const { data: cfg } = await supabase
    .from("module_config")
    .select("config")
    .eq("org_id", orgId)
    .eq("module", "dashboard")
    .maybeSingle<{ config: Record<string, unknown> | null }>();

  const secoesBrutas = cfg?.config?.secoes;
  const secoes: SecaoDash[] = Array.isArray(secoesBrutas)
    ? SECOES_DASH.filter((s) => (secoesBrutas as unknown[]).includes(s))
    : SECOES_DASH;

  return {
    ok: true,
    dados: {
      cliente: {
        nome: org.name,
        logoUrl: /^https?:\/\//i.test(String(org.logo_url ?? ""))
          ? String(org.logo_url)
          : null,
        secoes: secoes.length ? secoes : SECOES_DASH,
      },
      periodos,
    },
  };
}
