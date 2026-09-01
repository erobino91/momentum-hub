import { createClient } from "@/lib/supabase/server";
import { MODULE_KEYS, moduloPronto, type ModuleKey } from "@/lib/modules";
import type { MembershipRole, ModulosConfigurados, Org } from "@/types/db";

export type ModuloDoCliente = {
  chave: ModuleKey;
  /**
   * O recurso deste módulo já existe para a empresa (slug do dashboard
   * preenchido, página de bio criada, restaurante preparado). **Não é
   * permissão** — todo cliente tem todos os módulos; isto só diz se já dá para
   * entrar ou se ainda está sendo configurado.
   */
  configurado: boolean;
};

export type Sessao = {
  userId: string;
  email: string | null;
  org: Org | null;
  role: MembershipRole | null;
  ehAgencia: boolean;
  /** Todos os módulos, sempre — o que varia é o `configurado` de cada um. */
  modulos: ModuloDoCliente[];
};

/**
 * Lê o usuário logado e o que ele pode ver. Devolve `null` se não houver sessão
 * — o middleware já redireciona antes, isto é só a rede de segurança.
 */
export async function carregarSessao(): Promise<Sessao | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Duas consultas em vez de um join: o tipo gerado pelo embed do PostgREST vem
  // como `any[]` e obrigaria um cast que esconde erro de verdade.
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, org_id")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle<{ role: MembershipRole; org_id: string }>();

  const role = membership?.role ?? null;

  let org: Org | null = null;
  if (membership) {
    const { data } = await supabase
      .from("orgs")
      .select("*")
      .eq("id", membership.org_id)
      .maybeSingle<Org>();
    org = data ?? null;
  }

  // Quem responde é uma função `security definer`, não uma query direta: a RLS
  // de `restaurants` filtra por `profiles`, e o dono da empresa no portal não
  // tem `profiles` de propósito (membership é org-wide e daria ao balcão o
  // dashboard de faturamento). Sem a função, a sessão dele leria zero linhas e
  // concluiria que a própria empresa não tem fila.
  let prontos: ModulosConfigurados = { dashboard: false, bio: false, fila: false };
  if (org) {
    const { data } = await supabase.rpc("modulos_configurados", { p_org: org.id });
    if (data) prontos = data as ModulosConfigurados;
  }

  const modulos = MODULE_KEYS.map((chave) => ({
    chave,
    configurado: moduloPronto(chave, prontos),
  }));

  return {
    userId: user.id,
    email: user.email ?? null,
    org,
    role,
    ehAgencia: role === "agency",
    modulos,
  };
}
