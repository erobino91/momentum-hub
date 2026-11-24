import { notFound } from "next/navigation";
import { carregarPedidos, evento, temAcesso } from "@/lib/retirada";
import { Aviso } from "@/components/ui";
import { Entrar, Lista } from "./lista";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Retirada",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Balcão de retirada de venda antecipada. Sem login do portal: quem entra é o
 * PIN do evento. A lista é lida do Goomer a cada abertura.
 */
export default async function RetiradaPage({ params }: { params: { slug: string } }) {
  const ev = evento(params.slug);
  if (!ev) notFound();

  let conteudo;
  if (!temAcesso(params.slug)) {
    conteudo = <Entrar slug={params.slug} />;
  } else {
    try {
      conteudo = <Lista slug={params.slug} pedidos={await carregarPedidos(params.slug)} />;
    } catch (e) {
      console.error("retirada", params.slug, e);
      conteudo = (
        <Aviso>
          Não consegui ler os pedidos do Goomer agora. Atualize a página em alguns segundos.
        </Aviso>
      );
    }
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-line bg-surface-1">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2.5 px-4 py-3">
          <span
            aria-hidden
            className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand text-sm font-extrabold tracking-tighter text-white"
          >
            M
          </span>
          <span className="min-w-0 truncate text-sm font-bold tracking-tight">{ev.titulo}</span>
        </div>
      </div>
      <main className="mx-auto w-full max-w-3xl px-4 py-5">{conteudo}</main>
    </div>
  );
}
