import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import { criarPagina } from "./actions";
import { URL_BIO } from "@/lib/bio/url";
import type { LinkPage } from "@/types/bio";

export const dynamic = "force-dynamic";

export default async function BioIndex({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: paginas } = await supabase
    .from("link_pages")
    .select("id, slug, title, active")
    .order("created_at")
    .returns<Pick<LinkPage, "id" | "slug" | "title" | "active">[]>();

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Bio</p>
          <h1 className="mt-2 text-3xl font-semibold">Sua página de links</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          Voltar ao portal
        </Link>
      </header>

      {searchParams.erro ? (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {searchParams.erro}
        </p>
      ) : null}

      <div className="mt-8 space-y-3">
        {(paginas ?? []).map((p) => (
          <Link
            key={p.id}
            href={`/bio/${p.id}`}
            className="flex items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/5 px-5 py-4 transition hover:border-accent"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{p.title}</p>
              <p className="truncate text-xs text-muted">
                {URL_BIO}/{p.slug}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                p.active
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-white/10 text-muted"
              }`}
            >
              {p.active ? "no ar" : "rascunho"}
            </span>
          </Link>
        ))}
      </div>

      <section className="mt-8 rounded-lg border border-white/15 bg-white/5 p-5">
        <h2 className="text-lg font-medium">Nova página</h2>
        <p className="mt-1 text-sm text-muted">
          O endereço é o final do link: {URL_BIO}/<span className="text-foreground">seu-endereco</span>
        </p>
        <form action={criarPagina} className="mt-4 flex flex-wrap gap-3">
          <input
            name="title"
            required
            placeholder="Nome que aparece na página"
            className={`${campoClasse} sm:w-64`}
          />
          <input
            name="slug"
            required
            placeholder="seu-endereco"
            className={`${campoClasse} sm:w-52`}
          />
          <button type="submit" className={`${botaoClasse} sm:w-auto sm:px-5`}>
            Criar
          </button>
        </form>
      </section>
    </main>
  );
}
