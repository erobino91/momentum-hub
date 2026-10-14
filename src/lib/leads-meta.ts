import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarCapi } from "@/lib/bio/rastreio";
import { primeiroNome, telefoneComPais, type EventoMeta } from "@/lib/leads";

/**
 * Avisa a Meta (Pixel da Momentum, pela CAPI) de um passo do funil de um lead.
 *
 * **No máximo uma vez por lead e evento**, e quem garante é o banco: a linha de
 * `lp_lead_eventos` nasce antes do envio, com `unique (lead_id, evento)`, e só
 * é reenviada enquanto `enviado_em` for nulo. A Meta não desfaz uma venda que
 * recebeu, então mudar a situação de um lead para lá e para cá não pode mandar
 * dois Purchase.
 *
 * Nunca lança: quem chama é uma action da tela ou a rota que a LP aciona, e um
 * evento que não chegou fica registrado com o erro para reenviar.
 */

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");

/** A Meta pede nome em minúsculas; sem acento casa mais (Mário e Mario). */
function normalizarNome(nome: string) {
  return primeiroNome(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export type LeadParaMeta = {
  id: string;
  nome: string;
  whatsapp: string;
  fbp: string | null;
  fbc: string | null;
  created_at: string;
};

/**
 * Só existe quando quem chama é o navegador do próprio lead (a rota da LP). Com
 * ele o Lead vai como `website` e casa com o do Pixel; sem ele — reenvio pela
 * tela —, o navegador seria o da agência, então vai como `system_generated`.
 */
export type NavegadorDoLead = { ip: string | null; ua: string; url: string | null };

export async function avisarMeta(
  db: SupabaseClient,
  lead: LeadParaMeta,
  evento: EventoMeta,
  valor: number | null,
  navegador?: NavegadorDoLead,
): Promise<{ ok: boolean; erro?: string }> {
  const { error: erroRegistro } = await db
    .from("lp_lead_eventos")
    .upsert(
      { lead_id: lead.id, evento, valor },
      { onConflict: "lead_id,evento", ignoreDuplicates: true },
    );
  if (erroRegistro) return { ok: false, erro: "Não foi possível registrar o evento." };

  // Venda que ainda não chegou acompanha o último valor informado; venda que
  // chegou não muda mais.
  if (valor !== null) {
    await db
      .from("lp_lead_eventos")
      .update({ valor })
      .eq("lead_id", lead.id)
      .eq("evento", evento)
      .is("enviado_em", null);
  }

  const { data: linha } = await db
    .from("lp_lead_eventos")
    .select("id, valor, enviado_em")
    .eq("lead_id", lead.id)
    .eq("evento", evento)
    .maybeSingle<{ id: string; valor: number | null; enviado_em: string | null }>();

  if (!linha) return { ok: false, erro: "Evento não encontrado." };
  if (linha.enviado_em) return { ok: true };

  const pixelId = process.env.MMT_PIXEL_ID;
  const token = process.env.MMT_CAPI_TOKEN;
  const r =
    pixelId && token
      ? await enviarCapi({
          pixelId,
          token,
          eventName: evento,
          // O Lead repete o `eventID` que o Pixel mandou na página de obrigado
          // (o id do lead, gerado no form). Os outros só precisam ser únicos.
          eventId: evento === "Lead" ? lead.id : `${lead.id}-${evento}`,
          eventTime:
            evento === "Lead"
              ? Math.floor(new Date(lead.created_at).getTime() / 1000)
              : undefined,
          actionSource: navegador ? "website" : "system_generated",
          eventSourceUrl: navegador?.url ?? undefined,
          visitante: {
            ip: navegador?.ip ?? null,
            ua: navegador?.ua ?? null,
            fbp: lead.fbp,
            fbc: lead.fbc,
          },
          userDataHash: {
            ph: [sha256(telefoneComPais(lead.whatsapp))],
            fn: [sha256(normalizarNome(lead.nome))],
            country: [sha256("br")],
            external_id: [sha256(lead.id)],
          },
          customData:
            evento === "Purchase"
              ? { value: Number(linha.valor), currency: "BRL" }
              : undefined,
        })
      : { ok: false, status: null, erro: "MMT_PIXEL_ID ou MMT_CAPI_TOKEN não configurado." };

  await db
    .from("lp_lead_eventos")
    .update(
      r.ok
        ? { enviado_em: new Date().toISOString(), erro: null }
        : { erro: (r.erro ?? `HTTP ${r.status}`).slice(0, 300) },
    )
    .eq("id", linha.id);

  return r.ok ? { ok: true } : { ok: false, erro: "A Meta não recebeu o evento." };
}
