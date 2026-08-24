"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { paraNumero } from "@/lib/numero";

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

/** A mesma leitura da tela e do fechamento do mês. */
function numero(valor: FormDataEntryValue | null): number | null {
  return paraNumero(String(valor ?? ""));
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
