import { NextResponse, type NextRequest } from "next/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { enviarCapi, lerVisitante } from "@/lib/bio/rastreio";

/**
 * PageView da bio pela CAPI.
 *
 * O Pixel do navegador já manda o PageView; este aqui manda o mesmo evento com
 * o mesmo `event_id`, do servidor. Serve para dois casos:
 *   - bloqueador de anúncio ligado: o Pixel não carrega e só este chega;
 *   - Pixel normal: os dois chegam e a Meta deduplica pelo `event_id`.
 *
 * A rota é aberta por natureza (a página é pública). O que ela aceita é só um
 * slug ativo — não dá para escolher pixel nem token, que vêm do banco.
 */

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let corpo: { slug?: string; eventId?: string; fbclid?: string | null };
  try {
    corpo = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const slug = typeof corpo.slug === "string" ? corpo.slug : null;
  const eventId = typeof corpo.eventId === "string" ? corpo.eventId : null;
  if (!slug || !eventId) return new NextResponse(null, { status: 400 });

  const db = clienteSecreto();
  const { data: pagina } = await db
    .from("link_pages")
    .select("id, slug, pixel_id")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<{ id: string; slug: string; pixel_id: string | null }>();

  // Sem pixel não há para onde mandar — responde 204 do mesmo jeito, para a
  // rota não virar um jeito de descobrir quais páginas existem.
  if (!pagina?.pixel_id) return new NextResponse(null, { status: 204 });

  const { data: segredo } = await db
    .from("link_secrets")
    .select("capi_token")
    .eq("page_id", pagina.id)
    .maybeSingle<{ capi_token: string }>();

  if (segredo?.capi_token) {
    await enviarCapi({
      pixelId: pagina.pixel_id,
      token: segredo.capi_token,
      eventName: "PageView",
      eventId,
      eventSourceUrl: new URL(`/b/${pagina.slug}`, request.url).toString(),
      visitante: lerVisitante(
        request.headers,
        request.cookies,
        typeof corpo.fbclid === "string" ? corpo.fbclid : null,
      ),
    });
  }

  return new NextResponse(null, { status: 204 });
}
