import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { BeaconPageview, BioRender } from "@/components/bio-render";
import { carregarPaginaPublica, snippetPixel } from "@/lib/bio/publico";
import { temaCompleto } from "@/types/bio";

/**
 * A página pública do bio — `bio.mmtdigital.com.br/<slug>`, reescrita para cá
 * pelo middleware.
 *
 * Cache de 60s: é uma página de campanha, pode tomar pico de tráfego de anúncio.
 * Nada aqui depende da requisição, porque o `event_id` do PageView é gerado no
 * navegador (ver `snippetPixel`) — se fosse gerado no servidor, todo visitante
 * cacheado receberia o mesmo id e a Meta trataria vários pageviews como um só.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const pagina = await carregarPaginaPublica(params.slug);
  if (!pagina) return { title: "Página não encontrada" };

  return {
    title: pagina.title,
    description: pagina.bio ?? undefined,
    openGraph: {
      title: pagina.title,
      description: pagina.bio ?? undefined,
      images: pagina.avatarUrl ? [pagina.avatarUrl] : undefined,
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}

/**
 * A barra do navegador no celular acompanha o fundo da página. Fica em
 * `generateViewport` e não em `generateMetadata`: no Next 14 `themeColor` saiu
 * do metadata e lá vira aviso de build, sem efeito nenhum.
 */
export async function generateViewport({
  params,
}: {
  params: { slug: string };
}): Promise<Viewport> {
  const pagina = await carregarPaginaPublica(params.slug);
  return { themeColor: temaCompleto(pagina?.tema).fundo };
}

export default async function BioPage({ params }: { params: { slug: string } }) {
  const pagina = await carregarPaginaPublica(params.slug);
  if (!pagina) notFound();

  return (
    <>
      {pagina.pixelId ? (
        <script
          // Inline e no corpo do HTML de propósito: roda antes da hidratação,
          // então `window.__bioEventId` já existe quando o beacon procura por ele.
          dangerouslySetInnerHTML={{ __html: snippetPixel(pagina.pixelId) }}
        />
      ) : null}
      <BioRender pagina={pagina} />
      {pagina.pixelId ? <BeaconPageview slug={pagina.slug} /> : null}
    </>
  );
}
