import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { criarPagina } from "./actions";
import { URL_BIO } from "@/lib/bio/url";
import type { LinkPage } from "@/types/bio";
import type { Org } from "@/types/db";
import { AgenciaShell, PortalShell } from "@/components/shell";
import {
  Aviso,
  BotaoEnviar,
  Campo,
  Dialogo,
  Entrada,
  Selecao,
  Selo,
  Vazio,
  opcaoEstilo,
} from "@/components/ui";

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
              className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-1 px-5 py-4 transition hover:border-line-strong"
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
              <span className="shrink-0">
                <Selo tom={p.active ? "pronto" : "neutro"}>
                  {p.active ? "no ar" : "rascunho"}
                </Selo>
              </span>
            </Link>
          ))}
        </div>
      )}

      {ehAgencia && (orgs ?? []).length ? (
        <div className="mt-6">
          <DialogoNovaPagina orgs={orgs ?? []} />
        </div>
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

/**
 * Criar página de bio. Sai do formulário sempre aberto no rodapé: é uma ação
 * por cliente, não algo que se faça toda visita.
 */
function DialogoNovaPagina({ orgs }: { orgs: Pick<Org, "id" | "name">[] }) {
  return (
    <Dialogo
      rotulo="+ Nova página"
      variante="primario"
      tamanho="sm"
      titulo="Nova página de bio"
      descricao={`O endereço é o final do link: ${URL_BIO}/endereco-do-cliente`}
    >
      <form action={criarPagina} className="space-y-3">
        <Campo rotulo="Empresa" obrigatorio>
          <Selecao name="org_id" required defaultValue="">
            <option value="" disabled className={opcaoEstilo}>
              Escolha…
            </option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id} className={opcaoEstilo}>
                {o.name}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Nome que aparece na página" obrigatorio>
          <Entrada name="title" required placeholder="BB Onça Burguers" />
        </Campo>
        <Campo
          rotulo="Endereço"
          obrigatorio
          ajuda="Só letras minúsculas, números e hífen."
        >
          <Entrada name="slug" required pattern="[a-z0-9-]+" placeholder="bb-onca" />
        </Campo>
        <div className="flex justify-end pt-1">
          <BotaoEnviar pendente="Criando…">Criar página</BotaoEnviar>
        </div>
      </form>
    </Dialogo>
  );
}
