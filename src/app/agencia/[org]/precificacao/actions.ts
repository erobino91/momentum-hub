"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function exigirAgencia() {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");
  return supabase;
}

function voltar(orgId: string, erro?: string): never {
  revalidatePath(`/agencia/${orgId}/precificacao`);
  redirect(
    `/agencia/${orgId}/precificacao${erro ? `?erro=${encodeURIComponent(erro)}` : ""}`,
  );
}

/** Aceita `12,90` e `12.90` — quem digita está vindo de planilha. */
function numero(valor: FormDataEntryValue | null): number | null {
  const texto = String(valor ?? "").trim().replace("R$", "").trim();
  if (!texto) return null;
  const normalizado =
    texto.includes(",") && texto.includes(".")
      ? texto.replace(/\./g, "").replace(",", ".")
      : texto.replace(",", ".");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/**
 * As quatro variáveis da conta. `taxa_extra` é percentual; `campanha`,
 * `entrega` e `cupom` são reais — unidades herdadas do projeto antigo e
 * confirmadas antes da migração.
 */
export async function salvarVariaveis(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  if (!orgId) redirect("/agencia");

  const { error } = await supabase.from("pricing_config").upsert(
    {
      org_id: orgId,
      taxa_extra: numero(formData.get("taxa_extra")) ?? 0,
      campanha: numero(formData.get("campanha")) ?? 0,
      entrega: numero(formData.get("entrega")) ?? 0,
      cupom: numero(formData.get("cupom")) ?? 0,
    },
    { onConflict: "org_id" },
  );

  if (error) voltar(orgId, "Não foi possível salvar as variáveis.");
  voltar(orgId);
}

export async function criarProduto(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const preco = numero(formData.get("preco_balcao"));

  if (!orgId) redirect("/agencia");
  if (!name) voltar(orgId, "Informe o nome do produto.");
  if (preco === null || preco <= 0) voltar(orgId, "Informe o preço de balcão.");

  const { error } = await supabase
    .from("pricing_products")
    .insert({ org_id: orgId, name, preco_balcao: preco });

  if (error) voltar(orgId, "Não foi possível cadastrar o produto.");
  voltar(orgId);
}

export async function atualizarPreco(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const id = String(formData.get("id") ?? "");
  const preco = numero(formData.get("preco_balcao"));

  if (!orgId || !id) redirect("/agencia");
  if (preco === null || preco <= 0) voltar(orgId, "Preço inválido.");

  const { error } = await supabase
    .from("pricing_products")
    .update({ preco_balcao: preco })
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) voltar(orgId, "Não foi possível atualizar o preço.");
  voltar(orgId);
}

export async function apagarProduto(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!orgId || !id) redirect("/agencia");

  const { error } = await supabase
    .from("pricing_products")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) voltar(orgId, "Não foi possível remover o produto.");
  voltar(orgId);
}
