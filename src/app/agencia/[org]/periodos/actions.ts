"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAgencia } from "@/lib/agencia";
import { CAMPOS_PERIODO, primeiroDiaDoMes } from "@/lib/periodos";
import { paraNumero } from "@/lib/numero";

function voltar(orgId: string, erro?: string, mes?: string): never {
  revalidatePath(`/agencia/${orgId}/periodos`);
  const params = new URLSearchParams();
  if (erro) params.set("erro", erro);
  else params.set("ok", "1");
  if (mes) params.set("mes", mes);
  redirect(`/agencia/${orgId}/periodos?${params}`);
}

/**
 * Campo vazio vira `null`, não zero: o dashboard distingue "mês sem investimento
 * em Google" de "ninguém preencheu ainda" — o primeiro mostra R$ 0, o segundo
 * some com o bloco.
 */
function numero(valor: FormDataEntryValue | null): number | null {
  // `paraNumero` é a mesma leitura que o campo usa na tela, e é o que aceita
  // `147.456,00` — o `Number(texto.replace(",", "."))` de antes devolvia NaN
  // para qualquer valor com separador de milhar, e NaN aqui virava campo vazio.
  return paraNumero(String(valor ?? ""));
}

export async function salvarPeriodo(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  if (!orgId) redirect("/agencia");

  const mes = primeiroDiaDoMes(String(formData.get("period_date") ?? ""));
  if (!mes) voltar(orgId, "Mês inválido.");

  const linha: Record<string, unknown> = { org_id: orgId, period_date: mes };
  for (const campo of CAMPOS_PERIODO) {
    linha[campo.coluna] = numero(formData.get(campo.coluna));
  }
  linha.obs_raw = String(formData.get("obs_raw") ?? "").trim() || null;
  linha.obs_polished = String(formData.get("obs_polished") ?? "").trim() || null;

  const { error } = await supabase
    .from("dashboard_periods")
    .upsert(linha, { onConflict: "org_id,period_date" });

  if (error) voltar(orgId, "Não foi possível salvar o mês.", mes);

  // O dashboard do cliente é `force-dynamic`, mas o portal lista os cards a
  // partir de `modulos_configurados` — e o primeiro mês publicado acende um.
  revalidatePath("/");
  voltar(orgId, undefined, mes);
}

export async function apagarPeriodo(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!orgId || !id) redirect("/agencia");

  const { error } = await supabase
    .from("dashboard_periods")
    .delete()
    .eq("id", id)
    .eq("org_id", orgId);

  if (error) voltar(orgId, "Não foi possível apagar o mês.");
  revalidatePath("/");
  voltar(orgId);
}
