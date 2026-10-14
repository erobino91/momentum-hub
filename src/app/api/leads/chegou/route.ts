import { NextResponse, type NextRequest } from "next/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { lerVisitante } from "@/lib/bio/rastreio";
import { avisarMeta, type LeadParaMeta } from "@/lib/leads-meta";

/**
 * O form da LP avisa aqui, logo depois de gravar o lead, para o hub mandar o
 * Lead pela CAPI com o mesmo id que o Pixel usa como `eventID`.
 *
 * Quem chama é o navegador do lead — é isso que dá IP e User-Agent de verdade
 * ao evento. A LP mora em outro domínio e chama com `mode: "no-cors"` e corpo
 * em texto, que não dispara preflight; por isso o corpo é lido como texto.
 *
 * A rota é aberta, então só aceita o id de um lead gravado na última hora, e o
 * evento sai no máximo uma vez por lead (`avisarMeta`). Repetir a chamada não
 * faz nada.
 */

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let id: unknown;
  try {
    id = JSON.parse(await request.text())?.id;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (typeof id !== "string" || !UUID.test(id)) {
    return new NextResponse(null, { status: 400 });
  }

  const db = clienteSecreto();
  const { data: lead } = await db
    .from("lp_leads")
    .select("id, nome, whatsapp, fbp, fbc, created_at")
    .eq("id", id)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .maybeSingle<LeadParaMeta>();

  if (!lead) return new NextResponse(null, { status: 404 });

  const v = lerVisitante(request.headers, { get: () => undefined });
  await avisarMeta(
    db,
    lead,
    "Lead",
    null,
    v.ua
      ? { ip: v.ip, ua: v.ua, url: v.referrer ?? request.headers.get("origin") }
      : undefined,
  );

  return new NextResponse(null, { status: 204 });
}
