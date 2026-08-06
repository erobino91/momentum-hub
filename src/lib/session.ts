import { createClient } from "@/lib/supabase/server";
import type { ModuleKey } from "@/lib/modules";
import type { MembershipRole, Org } from "@/types/db";

export type Sessao = {
  userId: string;
  email: string | null;
  org: Org | null;
  role: MembershipRole | null;
  ehAgencia: boolean;
  /** Módulos com `enabled = true` na org do usuário. */
  modulos: ModuleKey[];
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

  let modulos: ModuleKey[] = [];
  if (org) {
    const { data: ents } = await supabase
      .from("entitlements")
      .select("module, enabled")
      .eq("org_id", org.id)
      .eq("enabled", true);
    modulos = (ents ?? []).map((e) => e.module as ModuleKey);
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    org,
    role,
    ehAgencia: role === "agency",
    modulos,
  };
}
