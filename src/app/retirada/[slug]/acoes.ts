"use server";

import { revalidatePath } from "next/cache";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { evento, gravarAcesso, pinConfere, temAcesso } from "@/lib/retirada";

export async function entrar(slug: string, _: unknown, form: FormData) {
  const pin = String(form.get("pin") ?? "");
  if (!evento(slug) || !pinConfere(slug, pin)) return { erro: "Código errado." };
  gravarAcesso(slug, pin);
  revalidatePath(`/retirada/${slug}`);
  return { erro: null };
}

export async function marcarRetirado(slug: string, orderId: string, retirado: boolean) {
  if (!temAcesso(slug)) throw new Error("Sem acesso.");
  const tabela = clienteSecreto().from("retiradas");
  const { error } = retirado
    ? await tabela.upsert({ evento: slug, order_id: orderId }, { ignoreDuplicates: true })
    : await tabela.delete().eq("evento", slug).eq("order_id", orderId);
  if (error) throw error;
}
