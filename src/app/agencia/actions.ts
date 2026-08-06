"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULE_KEYS, type ModuleKey } from "@/lib/modules";

/**
 * Todas as escritas aqui passam pela RLS: a policy `*_write_agency` só deixa
 * quem tem papel `agency` gravar. A checagem no servidor é uma segunda camada,
 * para devolver mensagem em vez de erro cru.
 */
async function exigirAgencia() {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");
  return supabase;
}

function voltar(erro?: string): never {
  revalidatePath("/agencia");
  redirect(erro ? `/agencia?erro=${encodeURIComponent(erro)}` : "/agencia?ok=1");
}

export async function criarOrg(formData: FormData) {
  const supabase = await exigirAgencia();
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();

  if (!name || !slug) voltar("Nome e slug são obrigatórios.");
  if (!/^[a-z0-9-]+$/.test(slug))
    voltar("O slug aceita só letras minúsculas, números e hífen.");

  const { data: org, error } = await supabase
    .from("orgs")
    .insert({ name, slug })
    .select("id")
    .single();

  if (error || !org) voltar("Não foi possível criar. O slug já pode existir.");

  // Cria as quatro linhas de entitlement desligadas, para o toggle ser um
  // update simples depois.
  await supabase
    .from("entitlements")
    .insert(
      MODULE_KEYS.map((key) => ({
        org_id: org.id,
        module: key,
        enabled: false,
      })),
    );

  voltar();
}

export async function alternarModulo(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const modulo = String(formData.get("module") ?? "") as ModuleKey;
  const ligar = String(formData.get("ligar") ?? "") === "1";

  if (!orgId || !MODULE_KEYS.includes(modulo)) voltar("Módulo inválido.");

  const { error } = await supabase
    .from("entitlements")
    .upsert(
      { org_id: orgId, module: modulo, enabled: ligar },
      { onConflict: "org_id,module" },
    );

  if (error) voltar("Não foi possível alterar o módulo.");
  voltar();
}

/**
 * Grava o slug do cliente no dashboard antigo. Fica em `entitlements.config`
 * porque é configuração de um módulo, não da empresa — e a RLS de
 * `entitlements` já impede uma org de ler a config da outra.
 */
export async function salvarSlugDashboard(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const slug = String(formData.get("dashboard_slug") ?? "")
    .trim()
    .toLowerCase();

  if (!orgId) voltar("Empresa inválida.");
  if (slug && !/^[a-z0-9-]+$/.test(slug))
    voltar("O slug aceita só letras minúsculas, números e hífen.");

  // Lê para preservar o resto do `config` — o upsert reescreve a coluna inteira.
  const { data: atual } = await supabase
    .from("entitlements")
    .select("config")
    .eq("org_id", orgId)
    .eq("module", "dashboard")
    .maybeSingle<{ config: Record<string, unknown> | null }>();

  const config = { ...(atual?.config ?? {}) };
  if (slug) config.dashboard_slug = slug;
  else delete config.dashboard_slug;

  const { error } = await supabase
    .from("entitlements")
    .upsert(
      { org_id: orgId, module: "dashboard", config },
      { onConflict: "org_id,module" },
    );

  if (error) voltar("Não foi possível salvar o slug do dashboard.");
  voltar();
}

export async function convidarUsuario(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "owner");

  if (!orgId || !email) voltar("Informe o email.");

  const { error } = await supabase
    .from("invites")
    .insert({ org_id: orgId, email, role });

  if (error) voltar("Já existe convite pendente para esse email nesta empresa.");
  voltar();
}
