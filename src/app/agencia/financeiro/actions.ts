"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAgencia } from "@/lib/agencia";
import { paraNumero } from "@/lib/numero";
import { primeiroDiaDoMes } from "@/lib/periodos";
import { hojeISO } from "@/lib/financeiro";

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
  voltar(mes);
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

  const { error } = await supabase
    .from("billing_charges")
    .update({ status: "cancelado", pago_em: null })
    .eq("id", id);

  if (error) voltar(mes, "Não foi possível cancelar a cobrança.");
  voltar(mes);
}
