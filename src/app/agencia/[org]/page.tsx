import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/modules";
import { URL_BIO } from "@/lib/bio/url";
import { criarPagina } from "@/app/bio/actions";
import { prepararFila } from "../actions";
import { AgenciaShell } from "@/components/shell";
import { AbasEmpresa } from "@/components/agencia/abas";
import { Numero } from "@/components/agencia/numero";
import { BotaoEnviar, Cartao, Selo, botaoEstilo } from "@/components/ui";
import {
  carregarEmpresas,
  mesAtrasado,
  mesCurto,
  reaisCurtos,
} from "@/lib/agencia";
import type { LinkPage } from "@/types/bio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empresa" };

/**
 * A tela de uma empresa — não existia até a Fase 8.
 *
 * O que havia era um cartão na lista geral com três links cinza saindo dele.
 * Aqui a empresa tem endereço próprio, e as ferramentas dela (resultados,
 * precificação, acessos) são abas em vez de rotas soltas.
 */
export default async function EmpresaPage({
  params,
}: {
  params: { org: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const empresas = await carregarEmpresas();
  const empresa = empresas.find((e) => e.id === params.org);
  if (!empresa) redirect("/agencia");

  const { data: pagina } = await supabase
    .from("link_pages")
    .select("id, slug, active")
    .eq("org_id", empresa.id)
    .maybeSingle<Pick<LinkPage, "id" | "slug" | "active">>();

  const atrasado = mesAtrasado(empresa.ultimo_mes);
  const tudoPronto = empresa.dashboard && empresa.bio && empresa.fila;

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[
        { rotulo: "Empresas", href: "/agencia" },
        { rotulo: empresa.name },
      ]}
      titulo={empresa.name}
      selo={
        tudoPronto ? (
          <Selo tom="pronto">tudo pronto</Selo>
        ) : (
          <Selo tom="atencao">em configuração</Selo>
        )
      }
      acoes={
        empresa.dashboard ? (
          <Link
            href={`/dashboard?org=${empresa.id}`}
            className={botaoEstilo("secundario", "sm")}
          >
            Ver como o cliente
          </Link>
        ) : null
      }
    >
      <AbasEmpresa orgId={empresa.id} ativa="geral" />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Numero
          rotulo={`Faturamento ${mesCurto(empresa.ultimo_mes)}`}
          valor={reaisCurtos(empresa.ultimo_faturamento)}
          alerta={atrasado ? "fechamento atrasado" : undefined}
        />
        <Numero rotulo="Meses publicados" valor={String(empresa.meses)} />
        <Numero rotulo="Produtos iFood" valor={String(empresa.produtos)} />
        <Numero
          rotulo="Acessos ao portal"
          valor={String(empresa.acessos)}
          alerta={empresa.acessos === 0 ? "ninguém entra ainda" : undefined}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Cartao
          titulo={MODULES.dashboard.label}
          descricao={
            empresa.dashboard
              ? `${empresa.meses} ${empresa.meses === 1 ? "mês publicado" : "meses publicados"} · último ${mesCurto(empresa.ultimo_mes)}`
              : "Nenhum mês publicado — o cliente vê “em configuração”."
          }
          acao={
            <Selo tom={empresa.dashboard ? "pronto" : "atencao"}>
              {empresa.dashboard ? "pronto" : "vazio"}
            </Selo>
          }
        >
          <Link
            href={`/agencia/${empresa.id}/periodos`}
            className={botaoEstilo(
              empresa.dashboard ? "secundario" : "primario",
              "sm",
            )}
          >
            {empresa.dashboard ? "Fechar um mês" : "Lançar o primeiro mês"}
          </Link>
        </Cartao>

        <Cartao
          titulo={MODULES.bio.label}
          descricao={
            !pagina
              ? "Nasce com o nome e o endereço da própria empresa."
              : pagina.active
                ? `${URL_BIO}/${pagina.slug}`
                : // Página nasce rascunho: o endereço só responde depois de
                  // ligar "Página no ar" no editor.
                  "Criada, mas ainda não está no ar — o endereço devolve 404."
          }
          acao={
            <Selo tom={pagina ? (pagina.active ? "pronto" : "atencao") : "atencao"}>
              {pagina ? (pagina.active ? "no ar" : "rascunho") : "não criada"}
            </Selo>
          }
        >
          {pagina ? (
            <Link
              href={`/bio/${pagina.id}`}
              className={botaoEstilo(pagina.active ? "secundario" : "primario", "sm")}
            >
              {pagina.active ? "Editar página" : "Publicar página"}
            </Link>
          ) : (
            <form action={criarPagina}>
              <input type="hidden" name="org_id" value={empresa.id} />
              <input type="hidden" name="slug" value={empresa.slug} />
              <input type="hidden" name="title" value={empresa.name} />
              <BotaoEnviar tamanho="sm" pendente="Criando…">
                Criar página de bio
              </BotaoEnviar>
            </form>
          )}
        </Cartao>

        <Cartao
          titulo={MODULES.fila.label}
          descricao={
            empresa.fila
              ? "Restaurante preparado e dono com acesso ao salão."
              : "Cria o restaurante e dá acesso ao dono."
          }
          acao={
            <Selo tom={empresa.fila ? "pronto" : "atencao"}>
              {empresa.fila ? "pronta" : "não preparada"}
            </Selo>
          }
        >
          {empresa.fila ? (
            <a
              href={MODULES.fila.href}
              target="_blank"
              rel="noreferrer"
              className={botaoEstilo("secundario", "sm")}
            >
              Abrir o Fila
            </a>
          ) : (
            <form action={prepararFila}>
              <input type="hidden" name="org_id" value={empresa.id} />
              <input
                type="hidden"
                name="destino"
                value={`/agencia/${empresa.id}`}
              />
              <BotaoEnviar tamanho="sm" pendente="Preparando…">
                Preparar fila
              </BotaoEnviar>
            </form>
          )}
        </Cartao>
        <Cartao
          titulo={MODULES.cmv.label}
          descricao="Quem preenche insumo, receita e produto é o cliente — não há o que configurar aqui."
          acao={<Selo tom="pronto">no ar</Selo>}
        >
          {/* O link carrega a empresa: no CMV a agência lê o dado do cliente,
              e escrever é recusado enquanto ela estiver vendo outra empresa. */}
          <a
            href={`${MODULES.cmv.href}/ver-empresa?org=${empresa.id}`}
            target="_blank"
            rel="noreferrer"
            className={botaoEstilo("secundario", "sm")}
          >
            Abrir o CMV
          </a>
        </Cartao>
      </div>

      <p className="mt-5 text-xs text-dim">
        Todo cliente tem os quatro módulos — o que muda é o módulo já estar
        configurado.
      </p>
    </AgenciaShell>
  );
}
