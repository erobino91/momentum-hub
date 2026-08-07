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

export type Invite = {
  id: string;
  email: string;
  org_id: string;
  role: MembershipRole;
  created_at: string;
  accepted_at: string | null;
};
