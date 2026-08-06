import Link from "next/link";
import { BioRender } from "@/components/bio-render";
import { URL_BIO } from "@/lib/bio/url";
import {
  botaoNoAr,
  temaCompleto,
  type LinkButton,
  type LinkPage,
} from "@/types/bio";

/**
 * O que o cliente vê: a bio montada e para onde cada botão leva, sem nenhum
 * campo editável. Quem monta é a agência — ver a migration
 * `20260806160000_phase3_bio_escrita_agencia.sql`.
 */
export function VisaoCliente({
  pagina,
  botoes,
}: {
  pagina: LinkPage;
  botoes: LinkButton[];
}) {
  const tema = temaCompleto(pagina.theme);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Bio</p>
          <h1 className="mt-2 truncate text-3xl font-semibold">{pagina.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {URL_BIO}/{pagina.slug}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
          <Link
            href={`/bio/${pagina.id}/relatorio`}
            className="hover:text-foreground"
          >
            Relatório de cliques
          </Link>
          <a
            href={`/b/${pagina.slug}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Abrir página
          </a>
          <Link href="/bio" className="hover:text-foreground">
            Voltar
          </Link>
        </div>
      </header>

      {!pagina.active ? (
        <p className="mt-6 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-sm text-muted">
          Esta página ainda não está no ar.
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-lg border border-white/15 bg-white/5 p-5">
          <h2 className="text-lg font-medium">Links publicados</h2>
          <p className="mt-1 text-sm text-muted">
            Para mudar textos, links ou ordem, fale com a gente.
          </p>

          <div className="mt-4 space-y-2">
            {botoes.length === 0 ? (
              <p className="text-sm text-muted">Nenhum link publicado ainda.</p>
            ) : (
              botoes.map((b) => {
                const noAr = botaoNoAr(b);
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {b.icon ? <span className="mr-1">{b.icon}</span> : null}
                        {b.label}
                      </p>
                      <p className="truncate text-xs text-muted">{b.url}</p>
                    </div>
                    <span
                      className={`shrink-0 text-[11px] font-semibold ${
                        noAr ? "text-emerald-400" : "text-muted"
                      }`}
                    >
                      {noAr ? "no ar" : "fora do ar"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Como está ficando
          </p>
          <div className="mt-2 overflow-hidden rounded-[2rem] border-4 border-white/15">
            <div className="max-h-[70vh] overflow-y-auto">
              <BioRender
                modo="preview"
                pagina={{
                  slug: pagina.slug,
                  title: pagina.title,
                  bio: pagina.bio,
                  avatarUrl: pagina.avatar_url,
                  tema,
                  pixelId: pagina.pixel_id,
                  botoes: botoes
                    .filter((b) => botaoNoAr(b))
                    .map((b) => ({ id: b.id, label: b.label, icon: b.icon })),
                }}
              />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
