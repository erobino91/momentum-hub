import { createClient } from "@/lib/supabase/server";
import {
  SECOES_DASH,
  type DadosDashboard,
  type PeriodoDash,
  type SecaoDash,
} from "@/types/dashboard";

/**
 * Busca do dashboard antigo, **sempre no servidor**.
 *
 * O slug do cliente no projeto antigo (`mynolirdauvkubxvlddt`) é a senha do
 * dashboard público: quem tem o slug abre `dash.html?c=<slug>` sem login. Por
 * isso ele fica guardado em `module_config.config.dashboard_slug`, a chamada à
 * RPC sai daqui e o que volta para o navegador não contém slug nem ids.
 */

export type FalhaDashboard =
  | "sem-sessao"
  | "sem-org"
  | "sem-slug"
  | "sem-dados"
  | "sem-config"
  | "erro";

export type ResultadoDashboard =
  | { ok: true; dados: DadosDashboard }
  | { ok: false; motivo: FalhaDashboard };

type RespostaRpc = {
  client?: {
    name?: string;
    logo_url?: string | null;
    active_sections?: string[] | null;
  } | null;
  periods?: Record<string, unknown>[] | null;
} | null;

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

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Copia campo a campo — nunca espalhar a linha crua, que traz `id`/`client_id`. */
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
  const url = process.env.DASHBOARD_SUPABASE_URL;
  const chave = process.env.DASHBOARD_SUPABASE_ANON_KEY;
  if (!url || !chave) return { ok: false, motivo: "sem-config" };

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

  // A RLS de `module_config` já barra org alheia; a query só devolve linha se o
  // usuário pertence à org (ou é agency).
  const { data: ent } = await supabase
    .from("module_config")
    .select("config")
    .eq("org_id", orgId)
    .eq("module", "dashboard")
    .maybeSingle<{ config: Record<string, unknown> | null }>();

  // Sem interruptor: quem decide se o dashboard abre é o slug estar preenchido.
  // Não existe "empresa sem o módulo" — existe empresa ainda sem configuração.
  const slug = texto(ent?.config?.dashboard_slug);
  if (!slug) return { ok: false, motivo: "sem-slug" };

  let corpo: RespostaRpc;
  try {
    const resposta = await fetch(`${url}/rest/v1/rpc/get_public_dashboard`, {
      method: "POST",
      headers: {
        apikey: chave,
        Authorization: `Bearer ${chave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_slug: slug }),
      cache: "no-store",
    });
    if (!resposta.ok) return { ok: false, motivo: "erro" };
    corpo = (await resposta.json()) as RespostaRpc;
  } catch {
    return { ok: false, motivo: "erro" };
  }

  // Slug errado ou cliente inativo no projeto antigo devolvem `null`.
  if (!corpo?.client?.name) return { ok: false, motivo: "sem-dados" };

  const periodos = (corpo.periods ?? [])
    .map(limparPeriodo)
    .filter((p): p is PeriodoDash => p !== null);
  if (periodos.length === 0) return { ok: false, motivo: "sem-dados" };

  const secoesBrutas = corpo.client.active_sections;
  const secoes = Array.isArray(secoesBrutas)
    ? SECOES_DASH.filter((s) => secoesBrutas.includes(s))
    : SECOES_DASH;

  return {
    ok: true,
    dados: {
      cliente: {
        nome: corpo.client.name,
        logoUrl: /^https?:\/\//i.test(String(corpo.client.logo_url ?? ""))
          ? String(corpo.client.logo_url)
          : null,
        secoes,
      },
      periodos,
    },
  };
}
