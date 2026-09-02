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

  // Quem manda nos campos de Meta é o banco, não o formulário: a tela some com
  // os dois quando a empresa tem conta vinculada. Reler aqui é o que impede um
  // envio montado à mão de zerar o que a API preencheu.
  const { data: org } = await supabase
    .from("orgs")
    .select("meta_ad_account_id")
    .eq("id", orgId)
    .maybeSingle<{ meta_ad_account_id: string | null }>();
  const metaSincronizado = Boolean(org?.meta_ad_account_id);

  // Mês que ainda não existe entra pelo `insert` do upsert, e ali coluna
  // omitida não fica em branco: pega o `default 0` da tabela, e o cliente veria
  // "R$ 0,00 investido" até alguém rodar o sincronizador. Por isso o valor
  // atual é lido e reenviado — `null` quando não há mês, o que é o mesmo que a
  // tela mostrava antes de existir integração.
  const { data: existente } = metaSincronizado
    ? await supabase
        .from("dashboard_periods")
        .select("meta_invest,meta_vendas")
        .eq("org_id", orgId)
        .eq("period_date", mes)
        .maybeSingle<Record<string, number | null>>()
    : { data: null };

  // Publicar é o próprio ato de salvar o fechamento — não existe chave separada
  // para alguém esquecer de virar. Rascunho é só o que o sincronizador criou e
  // ninguém fechou ainda.
  const linha: Record<string, unknown> = {
    org_id: orgId,
    period_date: mes,
    publicado: true,
  };
  for (const campo of CAMPOS_PERIODO) {
    linha[campo.coluna] =
      campo.origem === "meta" && metaSincronizado
        ? (existente?.[campo.coluna] ?? null)
        : numero(formData.get(campo.coluna));
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
