"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { paraNumero } from "@/lib/numero";
import { ehStatusLead, eventoDoStatus, type EventoMeta } from "@/lib/leads";
import { avisarMeta, type LeadParaMeta } from "@/lib/leads-meta";

export type ResultadoLead = { ok: true } | { erro: string };

/**
 * Chamadas direto da tabela (`useTransition`), não por `action={}`: o seletor de
 * situação fica em cada linha, e a linha mostra o resultado sem recarregar.
 * O cliente logado é agência — quem grava é a sessão dele, com a RLS
 * `is_agency()` valendo.
 */

const COLUNAS = "id, nome, whatsapp, fbp, fbc, created_at";

export async function mudarStatus(
  id: string,
  status: string,
  valorTexto?: string,
): Promise<ResultadoLead> {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");
  if (!ehStatusLead(status)) return { erro: "Situação inválida." };

  // A venda vai para a Meta com este valor e não tem volta lá — sem valor, não
  // vira cliente.
  let valor: number | null = null;
  if (status === "cliente") {
    valor = paraNumero(valorTexto ?? "");
    if (valor === null || valor <= 0) {
      return { erro: "Informe o valor mensal do contrato." };
    }
  }

  const { data: lead, error } = await supabase
    .from("lp_leads")
    .update({
      status,
      status_em: new Date().toISOString(),
      ...(valor !== null ? { valor_mensal: valor } : {}),
    })
    .eq("id", id)
    .select(COLUNAS)
    .maybeSingle<LeadParaMeta>();
  if (error || !lead) return { erro: "Não foi possível mudar a situação." };

  const evento = eventoDoStatus(status);
  if (evento) await avisarMeta(supabase, lead, evento, valor);

  revalidatePath("/agencia/leads");
  return { ok: true };
}

export async function reenviarEvento(
  leadId: string,
  evento: EventoMeta,
): Promise<ResultadoLead> {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data: lead } = await supabase
    .from("lp_leads")
    .select(COLUNAS)
    .eq("id", leadId)
    .maybeSingle<LeadParaMeta>();
  if (!lead) return { erro: "Lead não encontrado." };

  // `null`: o valor da venda já está na linha do evento.
  const r = await avisarMeta(supabase, lead, evento, null);

  revalidatePath("/agencia/leads");
  return r.ok ? { ok: true } : { erro: r.erro ?? "A Meta não recebeu o evento." };
}
