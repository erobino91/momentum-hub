import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/modules";
import { URL_BIO } from "@/lib/bio/url";
import { criarPagina } from "@/app/bio/actions";
import { prepararFila, salvarSecoes, trocarLinkDashboard } from "../actions";
import { AgenciaShell } from "@/components/shell";
import { AbasEmpresa } from "@/components/agencia/abas";
import { Numero } from "@/components/agencia/numero";
import { CopiarLink } from "@/components/agencia/copiar-link";
import {
  Aviso,
  BotaoEnviar,
  Cartao,
  ConfirmarAcao,
  Selo,
  botaoEstilo,
} from "@/components/ui";
import {
  carregarEmpresas,
  mesAtrasado,
  mesCurto,
  reaisCurtos,
} from "@/lib/agencia";
import { CONEXOES, COLUNAS_VINCULO, conexoesDe } from "@/lib/conexoes";
import { SECOES_DASH, ROTULO_SECAO } from "@/types/dashboard";
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
  searchParams,
}: {
  params: { org: string };
  searchParams: { erro?: string; ok?: string };
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

  // Fora de `agencia_empresas()`: a RPC monta a lista geral, e colunas que só
  // esta tela usa não têm por que atravessar todas as empresas.
  const { data: vinculos } = await supabase
    .from("orgs")
    .select([...COLUNAS_VINCULO, "dashboard_token"].join(","))
    .eq("id", empresa.id)
    .maybeSingle<Record<string, string | null>>();
  const conectadas = conexoesDe(vinculos);

  // Host desta requisição: em produção sai `portal.mmtdigital.com.br`, em
  // `localhost` o link copiado abre local.
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "portal.mmtdigital.com.br";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const linkDashboard = `${proto}://${host}/d/${vinculos?.dashboard_token ?? ""}`;

  // Quais blocos o cliente vê. Sem configuração, vê todos — é o mesmo padrão
  // que `lib/dashboard.ts` aplica do lado do cliente.
  const { data: cfgDash } = await supabase
    .from("module_config")
    .select("config")
    .eq("org_id", empresa.id)
    .eq("module", "dashboard")
    .maybeSingle<{ config: Record<string, unknown> | null }>();
  const secoesBrutas = cfgDash?.config?.secoes;
  const secoes = Array.isArray(secoesBrutas)
    ? SECOES_DASH.filter((s) => (secoesBrutas as unknown[]).includes(s))
    : SECOES_DASH;
  const secoesConfiguradas = Array.isArray(secoesBrutas);

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

      {searchParams.erro ? (
        <div className="mb-5">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}
      {searchParams.ok ? (
        <div className="mb-5">
          <Aviso tom="ok">Salvo.</Aviso>
        </div>
      ) : null}

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

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Cartao
          titulo="Conexões"
          descricao={
            conectadas.length
              ? "Os números destas plataformas vêm do sincronizador. Quem vincula é o back-end da integração."
              : "Sem conexão vinculada, todos os números do mês são digitados no fechamento."
          }
          acao={
            <Selo tom={conectadas.length ? "pronto" : "atencao"}>
              {conectadas.length
                ? `${conectadas.length} sincronizada${conectadas.length > 1 ? "s" : ""}`
                : "manual"}
            </Selo>
          }
        >
          {/* Só leitura: o vínculo é gravado pelo back-end da integração.
              Uma linha por conexão de `lib/conexoes.ts` — plataforma nova
              aparece aqui sozinha. */}
          <dl className="w-full space-y-2.5 text-sm">
            {CONEXOES.map((conexao) => (
              <div
                key={conexao.coluna}
                className="flex items-start justify-between gap-4 border-b border-line pb-2.5 last:border-0 last:pb-0"
              >
                <dt className="flex-none text-xs font-semibold text-dim">
                  {conexao.rotulo}
                </dt>
                <dd className="min-w-0 break-all text-right tabular">
                  {vinculos?.[conexao.coluna] ?? (
                    <span className="text-dim">—</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Cartao>

        <Cartao
          titulo="Link do dashboard"
          descricao="Abre os resultados sem login — é só mandar no WhatsApp. Quem tiver o link vê os números."
        >
          <p className="mb-4 break-all rounded-md border border-line bg-surface-2 px-3 py-2 text-xs tabular">
            {linkDashboard}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CopiarLink url={linkDashboard} />
            <ConfirmarAcao
              acao={trocarLinkDashboard}
              rotulo="Trocar link"
              titulo="Trocar o link do dashboard?"
              descricao="O link atual para de abrir na hora. Use se ele foi parar com quem não devia — depois mande o novo ao cliente."
              confirmar="Trocar link"
              pendente="Trocando…"
            >
              <input type="hidden" name="org_id" value={empresa.id} />
            </ConfirmarAcao>
          </div>
        </Cartao>

        <Cartao
          titulo="Blocos que o cliente vê"
          descricao="Desmarcar esconde o bloco no dashboard e para de exigir aquele número para fechar o mês."
          acao={
            <Selo tom={secoesConfiguradas ? "pronto" : "atencao"}>
              {secoesConfiguradas ? `${secoes.length} de 8` : "todos (padrão)"}
            </Selo>
          }
        >
          <form action={salvarSecoes} className="w-full">
            <input type="hidden" name="org_id" value={empresa.id} />
            <input
              type="hidden"
              name="destino"
              value={`/agencia/${empresa.id}`}
            />
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {SECOES_DASH.map((secao) => (
                <label
                  key={secao}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <input
                    type="checkbox"
                    name={`secao_${secao}`}
                    defaultChecked={secoes.includes(secao)}
                    className="h-4 w-4 accent-brand"
                  />
                  {ROTULO_SECAO[secao]}
                </label>
              ))}
            </div>
            <BotaoEnviar variante="secundario" tamanho="sm" pendente="Salvando…">
              Salvar blocos
            </BotaoEnviar>
          </form>
        </Cartao>
      </div>

      <p className="mt-5 text-xs text-dim">
        Todo cliente tem os quatro módulos — o que muda é o módulo já estar
        configurado.
      </p>
    </AgenciaShell>
  );
}
