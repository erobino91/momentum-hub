import { NextResponse, type NextRequest } from "next/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { enviarCapi, lerVisitante } from "@/lib/bio/rastreio";
import { botaoNoAr, type LinkButton } from "@/types/bio";

/**
 * O clique de um botão do bio.
 *
 * Passa por aqui em vez de ir direto no `href` porque é este desvio que permite
 * contar o clique e mandar o evento pela CAPI — que é o único caminho que
 * sobrevive a bloqueador de anúncio. O visitante perde alguns milissegundos e
 * ganha um 302.
 *
 * Nada aqui pode impedir o redirecionamento: se a gravação falhar ou a Meta
 * demorar, o usuário vai para o destino do mesmo jeito.
 */

export const dynamic = "force-dynamic";

type LinhaBotao = Pick<
  LinkButton,
  "id" | "url" | "label" | "page_id" | "active" | "starts_at" | "ends_at"
>;

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const db = clienteSecreto();

  const { data: botao } = await db
    .from("link_buttons")
    .select("id, url, label, page_id, active, starts_at, ends_at")
    .eq("id", params.id)
    .maybeSingle<LinhaBotao>();

  if (!botao) return new NextResponse("Link não encontrado", { status: 404 });

  const { data: pagina } = await db
    .from("link_pages")
    .select("slug, pixel_id, active")
    .eq("id", botao.page_id)
    .maybeSingle<{ slug: string; pixel_id: string | null; active: boolean }>();

  if (!pagina?.active) {
    return new NextResponse("Link não encontrado", { status: 404 });
  }

  // Botão fora do ar (desativado ou fora da janela): o link pode ter sido
  // salvo/compartilhado. Devolve para a bio em vez de dar erro na cara.
  if (!botaoNoAr(botao)) {
    return redirecionar(new URL(`/b/${pagina.slug}`, request.url).toString());
  }

  const url = new URL(request.url);
  const eventId = url.searchParams.get("e");
  const visitante = lerVisitante(
    request.headers,
    request.cookies,
    url.searchParams.get("fbclid"),
  );

  // `rotulo` guarda o texto do botão no momento do clique: se o botão for
  // renomeado ou apagado depois, o relatório do mês passado não muda.
  await db
    .from("link_clicks")
    .insert({
      page_id: botao.page_id,
      button_id: botao.id,
      rotulo: botao.label,
      ip_hash: visitante.ipHash,
      ua: visitante.ua,
      referrer: visitante.referrer,
      fbclid: visitante.fbclid,
      country: visitante.country,
      city: visitante.city,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  if (pagina.pixel_id && eventId) {
    const { data: segredo } = await db
      .from("link_secrets")
      .select("capi_token")
      .eq("page_id", botao.page_id)
      .maybeSingle<{ capi_token: string }>();

    if (segredo?.capi_token) {
      await enviarCapi({
        pixelId: pagina.pixel_id,
        token: segredo.capi_token,
        eventName: "BioClick",
        eventId,
        eventSourceUrl: new URL(`/b/${pagina.slug}`, request.url).toString(),
        visitante,
        customData: { content_name: botao.label },
      });
    }
  }

  return redirecionar(botao.url);
}

function redirecionar(destino: string) {
  const r = NextResponse.redirect(destino, 302);
  r.headers.set("Cache-Control", "no-store");
  return r;
}
