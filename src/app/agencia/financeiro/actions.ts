"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAgencia } from "@/lib/agencia";
import { paraNumero } from "@/lib/numero";
import { primeiroDiaDoMes } from "@/lib/periodos";
import { hojeISO } from "@/lib/financeiro";
import {
  asaasLigado,
  cancelarPagamento,
  desfazerRecebimento,
  enviarCobrancas,
  receberEmDinheiro,
} from "@/lib/asaas";

/**
 * Volta para a tela do mês em que a pessoa estava.
 *
 * O mês vai junto de propósito: marcar uma cobrança de junho e ser devolvido a
 * agosto é perder o lugar no meio de uma conferência.
 */
function voltar(mes: string, erro?: string): never {
  revalidatePath("/agencia/financeiro");
  const params = new URLSearchParams({ mes });
  if (erro) params.set("erro", erro);
  else params.set("ok", "1");
  redirect(`/agencia/financeiro?${params}`);
}

function mesDoFormulario(formData: FormData) {
  const mes = primeiroDiaDoMes(String(formData.get("mes") ?? ""));
  if (!mes) redirect("/agencia/financeiro");
  return mes;
}

/**
 * Cria as cobranças do mês para todo contrato ativo com valor vigente.
 *
 * A conta acontece no banco (`gerar_cobrancas`), não aqui: é lá que o valor é
 * congelado e o dia 31 é cortado no fim do mês, e ter a mesma regra escrita
 * duas vezes é ter duas regras.
 */
export async function gerarCobrancas(formData: FormData) {
  const supabase = await exigirAgencia();
  const mes = mesDoFormulario(formData);

  const { error } = await supabase.rpc("gerar_cobrancas", { p_mes: mes });
  if (error) voltar(mes, "Não foi possível gerar as cobranças do mês.");
  if (!asaasLigado()) voltar(mes);

  // Gerar e mandar ao ASAAS é o mesmo clique: clicar de novo só reenvia o que
  // falhou, porque a geração não duplica e o envio pula o que já foi.
  let resultado: Awaited<ReturnType<typeof enviarCobrancas>> | null = null;
  try {
    resultado = await enviarCobrancas(supabase, mes, hojeISO());
  } catch {
    resultado = null;
  }
  if (!resultado) voltar(mes, "Cobranças geradas, mas o envio ao ASAAS falhou.");
  if (resultado.problemas.length)
    voltar(
      mes,
      `${resultado.enviadas} enviada(s) ao ASAAS. Não foram: ${resultado.problemas.join("; ")}.`,
    );
  voltar(mes);
}

/** A cobrança com o vínculo do ASAAS, para as ações que precisam avisar lá. */
async function lerCobranca(
  supabase: Awaited<ReturnType<typeof exigirAgencia>>,
  id: string,
) {
  const { data } = await supabase
    .from("billing_charges")
    .select("status, valor, asaas_payment_id")
    .eq("id", id)
    .maybeSingle<{ status: string; valor: number; asaas_payment_id: string | null }>();
  return data;
}

/** Roda a chamada ao ASAAS e devolve a mensagem de erro, se houver. */
async function noAsaas(chamada: () => Promise<unknown>) {
  try {
    await chamada();
    return null;
  } catch (e) {
    return `ASAAS: ${(e as Error).message}`;
  }
}

export async function marcarPago(formData: FormData) {
  const supabase = await exigirAgencia();
  const mes = mesDoFormulario(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) voltar(mes, "Cobrança não encontrada.");

  const pagoEm = String(formData.get("pago_em") ?? "").trim() || hojeISO();
  // Valor em branco quer dizer "pagou o que devia" — quem digita algo aqui é
  // quem recebeu diferente do combinado (desconto, acréscimo, acerto).
  const valor = paraNumero(String(formData.get("valor") ?? ""));

  const atual = await lerCobranca(supabase, id);
  const pid = atual?.asaas_payment_id;
  if (pid && asaasLigado()) {
    const erro = await noAsaas(() =>
      receberEmDinheiro(pid, pagoEm, valor ?? Number(atual.valor)),
    );
    if (erro) voltar(mes, erro);
  }

  const { error } = await supabase
    .from("billing_charges")
    .update({
      status: "pago",
      pago_em: pagoEm,
      ...(valor !== null ? { valor } : {}),
    })
    .eq("id", id);

  if (error) voltar(mes, "Não foi possível marcar como pago.");
  voltar(mes);
}

/**
 * Desfaz o pagamento. Existe porque errar o clique em cima de dinheiro precisa
 * ter saída — sem isto, a correção seria mexer no banco à mão.
 */
export async function desfazerPagamento(formData: FormData) {
  const supabase = await exigirAgencia();
  const mes = mesDoFormulario(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) voltar(mes, "Cobrança não encontrada.");

  // Desfazer pagamento à mão desfaz lá também. Pagamento que entrou pelo
  // ASAAS ele recusa — e aí o erro aparece em vez de o hub discordar dele.
  const atual = await lerCobranca(supabase, id);
  const pid = atual?.asaas_payment_id;
  if (atual?.status === "pago" && pid && asaasLigado()) {
    const erro = await noAsaas(() => desfazerRecebimento(pid));
    if (erro) voltar(mes, erro);
  }

  const { error } = await supabase
    .from("billing_charges")
    .update({ status: "pendente", pago_em: null })
    .eq("id", id);

  if (error) voltar(mes, "Não foi possível desfazer o pagamento.");
  voltar(mes);
}

/**
 * Cancela a cobrança — não apaga. A linha continua existindo com status
 * `cancelado`, porque "esse mês não foi cobrado" é uma informação, e sumir com
 * a linha faria a geração recriá-la no próximo clique.
 */
export async function cancelarCobranca(formData: FormData) {
  const supabase = await exigirAgencia();
  const mes = mesDoFormulario(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) voltar(mes, "Cobrança não encontrada.");

  // Apaga lá e solta o vínculo: reabrir depois gera um pagamento novo no
  // próximo envio, em vez de apontar para uma fatura que não existe mais.
  const pid = (await lerCobranca(supabase, id))?.asaas_payment_id;
  if (pid && asaasLigado()) {
    const erro = await noAsaas(() => cancelarPagamento(pid));
    if (erro) voltar(mes, erro);
  }

  const { error } = await supabase
    .from("billing_charges")
    .update({ status: "cancelado", pago_em: null, asaas_payment_id: null, asaas_url: null })
    .eq("id", id);

  if (error) voltar(mes, "Não foi possível cancelar a cobrança.");
  voltar(mes);
}
