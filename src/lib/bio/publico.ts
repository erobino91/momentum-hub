import { clienteSecreto } from "@/lib/supabase/secreto";
import {
  botaoNoAr,
  temaCompleto,
  type LinkButton,
  type LinkPage,
  type PaginaPublica,
} from "@/types/bio";

/**
 * Leitura da página pública do bio. Roda com a chave secreta porque as tabelas
 * são fechadas para `anon` — quem enxerga o banco é este servidor, nunca o
 * navegador do visitante.
 */

type LinhaPagina = Pick<
  LinkPage,
  "id" | "slug" | "title" | "bio" | "avatar_url" | "theme" | "pixel_id"
>;

export async function carregarPaginaPublica(
  slug: string,
): Promise<PaginaPublica | null> {
  const db = clienteSecreto();

  const { data: pagina } = await db
    .from("link_pages")
    .select("id, slug, title, bio, avatar_url, theme, pixel_id")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle<LinhaPagina>();

  if (!pagina) return null;

  const { data: botoes } = await db
    .from("link_buttons")
    .select("id, label, icon, active, starts_at, ends_at")
    .eq("page_id", pagina.id)
    .order("position")
    .returns<
      (Pick<LinkButton, "id" | "label" | "icon" | "active" | "starts_at" | "ends_at">)[]
    >();

  return {
    slug: pagina.slug,
    title: pagina.title,
    bio: pagina.bio,
    avatarUrl: pagina.avatar_url,
    tema: temaCompleto(pagina.theme),
    pixelId: pagina.pixel_id,
    // A URL de destino fica no servidor: o clique passa por /r/<id> para ser
    // contado e virar evento de CAPI.
    botoes: (botoes ?? [])
      .filter((b) => botaoNoAr(b))
      .map((b) => ({ id: b.id, label: b.label, icon: b.icon })),
  };
}

/** Snippet oficial do Pixel + o `event_id` que a CAPI vai repetir. */
export function snippetPixel(pixelId: string): string {
  return `
window.__bioEventId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2);
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId.replace(/[^0-9]/g, "")}');
fbq('track','PageView',{},{eventID:window.__bioEventId});
`.trim();
}
