import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import { criarPagina } from "./actions";
import { URL_BIO } from "@/lib/bio/url";
import type { LinkPage } from "@/types/bio";
import type { Org } from "@/types/db";
import { AgenciaShell, PortalShell } from "@/components/shell";
import { Aviso, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bio" };

type Resumo = Pick<LinkPage, "id" | "slug" | "title" | "active" | "org_id">;

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

  const { data: ehAgencia } = await supabase.rpc("is_agency");

  // A RLS decide o alcance: agência enxerga as páginas de todas as empresas,
  // cliente só as da dele.
  const { data: paginas } = await supabase
    .from("link_pages")
    .select("id, slug, title, active, org_id")
    .order("created_at")
    .returns<Resumo[]>();

  // Só a agência precisa do nome da empresa — o cliente já sabe de quem é.
  const { data: orgs } = ehAgencia
    ? await supabase.from("orgs").select("id, name").order("name").returns<
        Pick<Org, "id" | "name">[]
      >()
    : { data: null };

  const nomeOrg = (id: string) =>
    orgs?.find((o) => o.id === id)?.name ?? "empresa";

  const conteudo = (
    <>
      {searchParams.erro ? (
        <div className="mb-6">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      {(paginas ?? []).length === 0 ? (
        <Vazio
          titulo={
            ehAgencia
              ? "Nenhuma página criada ainda"
              : "Sua página de links ainda está sendo montada"
          }
          descricao={
            ehAgencia
              ? "Crie a primeira no formulário abaixo."
              : "A agência avisa assim que ela estiver no ar."
          }
        />
      ) : (
        <div className="space-y-3">
          {(paginas ?? []).map((p) => (
            <Link
              key={p.id}
              href={`/bio/${p.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-white/15 bg-white/5 px-5 py-4 transition hover:border-accent"
            >
              <div className="min-w-0">
                {ehAgencia ? (
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    {nomeOrg(p.org_id)}
                  </p>
                ) : null}
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
      )}

      {ehAgencia ? (
        <section className="mt-8 rounded-lg border border-white/15 bg-white/5 p-5">
          <h2 className="text-lg font-medium">Nova página</h2>
          <p className="mt-1 text-sm text-muted">
            O endereço é o final do link: {URL_BIO}/
            <span className="text-foreground">endereco-do-cliente</span>
          </p>
          <form action={criarPagina} className="mt-4 flex flex-wrap gap-3">
            <select name="org_id" required className={`${campoClasse} sm:w-52`}>
              <option value="">Empresa…</option>
              {(orgs ?? []).map((o) => (
                <option key={o.id} value={o.id} className="bg-[#12151c]">
                  {o.name}
                </option>
              ))}
            </select>
            <input
              name="title"
              required
              placeholder="Nome que aparece na página"
              className={`${campoClasse} sm:w-56`}
            />
            <input
              name="slug"
              required
              placeholder="endereco-do-cliente"
              className={`${campoClasse} sm:w-48`}
            />
            <button type="submit" className={`${botaoClasse} sm:w-auto sm:px-5`}>
              Criar
            </button>
          </form>
        </section>
      ) : null}
    </>
  );

  // A mesma tela serve aos dois: a agência chega por ela pelo menu lateral e vê
  // as páginas de todas as empresas; o cliente chega pelo card do portal e vê a
  // dele. Quem separa o que cada um enxerga é a RLS, não esta escolha de casca.
  return ehAgencia ? (
    <AgenciaShell
      secao="bio"
      migalha={[{ rotulo: "Páginas de bio" }]}
      titulo="Páginas de links"
    >
      {conteudo}
    </AgenciaShell>
  ) : (
    <PortalShell
      titulo="Sua página de links"
      migalha={[{ rotulo: "Portal", href: "/" }, { rotulo: "Bio" }]}
      email={user.email ?? null}
      ehAgencia={false}
    >
      {conteudo}
    </PortalShell>
  );
}
