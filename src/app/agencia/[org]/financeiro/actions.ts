"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAgencia } from "@/lib/agencia";
import { paraNumero } from "@/lib/numero";
import { hojeISO } from "@/lib/financeiro";

function voltar(orgId: string, erro?: string): never {
  revalidatePath(`/agencia/${orgId}/financeiro`);
  revalidatePath("/agencia/financeiro");
  const params = new URLSearchParams();
  if (erro) params.set("erro", erro);
  else params.set("ok", "1");
  redirect(`/agencia/${orgId}/financeiro?${params}`);
}

function texto(formData: FormData, campo: string) {
  return String(formData.get(campo) ?? "").trim() || null;
}

/**
 * Cria ou atualiza o contrato — **sem tocar no valor**.
 *
 * O valor não entra aqui de propósito. Editar o contrato é corrigir o dia do
 * vencimento, pausar, mudar a forma de pagamento; trocar o preço é outro ato, e
 * tem outro caminho (`reajustar`), porque ele precisa de uma data de vigência.
 * Um campo de valor neste formulário viraria, no primeiro uso apressado, um
 * reajuste sem data — e reajuste sem data reescreve o passado.
 */
export async function salvarContrato(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  if (!orgId) redirect("/agencia");

  const dia = Number(formData.get("dia_vencimento"));
  if (!Number.isInteger(dia) || dia < 1 || dia > 31)
    voltar(orgId, "O dia do vencimento precisa ser de 1 a 31.");

  const linha = {
    org_id: orgId,
    situacao: String(formData.get("situacao") ?? "ativo"),
    dia_vencimento: dia,
    forma_pagamento: texto(formData, "forma_pagamento"),
    cliente_desde: texto(formData, "cliente_desde"),
    observacao: texto(formData, "observacao"),
  };

  const { data: contrato, error } = await supabase
    .from("billing_contracts")
    .upsert(linha, { onConflict: "org_id" })
    .select("id")
    .single<{ id: string }>();

  if (error || !contrato) voltar(orgId, "Não foi possível salvar o contrato.");

  // Contrato recém-criado vem com o primeiro valor no mesmo formulário: sem
  // ele o contrato existe e não gera cobrança nenhuma, que é um estado sem
  // utilidade nenhuma e difícil de perceber.
  const valor = paraNumero(String(formData.get("valor") ?? ""));
  if (valor !== null) {
    const { count } = await supabase
      .from("billing_values")
      .select("id", { count: "exact", head: true })
      .eq("contract_id", contrato.id);

    if (!count) {
      const { error: erroValor } = await supabase
        .from("billing_values")
        .insert({
          contract_id: contrato.id,
          valor,
          vigente_desde: linha.cliente_desde ?? hojeISO(),
        });
      if (erroValor)
        voltar(orgId, "Contrato salvo, mas o valor não foi registrado.");
    }
  }

  voltar(orgId);
}

/**
 * Reajuste: linha nova no histórico, nunca `update`.
 *
 * A data de vigência é obrigatória porque é ela que decide o que cada mês vale.
 * Cobranças já geradas não mudam — o valor delas foi congelado na geração, e é
 * essa a razão de o histórico existir.
 */
export async function reajustar(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const contratoId = String(formData.get("contrato_id") ?? "");
  if (!orgId || !contratoId) redirect("/agencia");

  const valor = paraNumero(String(formData.get("valor") ?? ""));
  if (valor === null || valor < 0) voltar(orgId, "Valor inválido.");

  const desde = texto(formData, "vigente_desde") ?? hojeISO();

  const { error } = await supabase
    .from("billing_values")
    .insert({ contract_id: contratoId, valor, vigente_desde: desde });

  if (error)
    voltar(
      orgId,
      // A única falha esperada é a chave única: já existe valor com essa data.
      "Já existe um valor com essa data de vigência. Apague o antigo ou escolha outra data.",
    );

  voltar(orgId);
}

/**
 * Apaga uma linha do histórico de valor — para corrigir digitação, não para
 * "desfazer" um reajuste. Cobrança já gerada não muda: o valor dela é cópia,
 * não referência.
 */
export async function removerValor(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!orgId || !id) redirect("/agencia");

  const { error } = await supabase.from("billing_values").delete().eq("id", id);
  if (error) voltar(orgId, "Não foi possível apagar esse valor.");
  voltar(orgId);
}
