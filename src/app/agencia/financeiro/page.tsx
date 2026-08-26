import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AgenciaShell } from "@/components/shell";
import { Numero } from "@/components/agencia/numero";
import {
  TabelaFinanceiro,
  ordenarPorUrgencia,
} from "@/components/agencia/tabela-financeiro";
import { Aviso, BotaoEnviar, Vazio, botaoEstilo } from "@/components/ui";
import { mesCurto } from "@/lib/agencia";
import { nomeDoMes, primeiroDiaDoMes } from "@/lib/periodos";
import {
  carregarFinanceiro,
  deslocarMes,
  emAberto,
  estadoCobranca,
  hojeISO,
  mesCorrente,
  reais,
} from "@/lib/financeiro";
import { gerarCobrancas } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Financeiro" };

type Filtro = "todas" | "atrasadas" | "aberto" | "pagas" | "sem-contrato";

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: "todas", rotulo: "Todas" },
  { chave: "atrasadas", rotulo: "Atrasadas" },
  { chave: "aberto", rotulo: "Em aberto" },
  { chave: "pagas", rotulo: "Pagas" },
  { chave: "sem-contrato", rotulo: "Sem contrato" },
];

/**
 * O mês de mensalidades da agência.
 *
 * Mês, filtro e busca ficam na URL: conferir o financeiro é uma tarefa que se
 * interrompe e se retoma, e voltar no navegador tem de cair no mesmo lugar.
 */
export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: {
    mes?: string;
    filtro?: Filtro;
    q?: string;
    erro?: string;
    ok?: string;
  };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const mes = primeiroDiaDoMes(searchParams.mes ?? "") ?? mesCorrente();
  const hoje = hojeISO();
  const linhas = await carregarFinanceiro(mes);

  const busca = (searchParams.q ?? "").trim().toLowerCase();
  const filtro: Filtro = searchParams.filtro ?? "todas";

  const combina = (l: (typeof linhas)[number], f: Filtro) => {
    const estado = estadoCobranca(l, hoje);
    if (f === "atrasadas") return estado === "atrasado";
    if (f === "aberto") return emAberto(estado);
    if (f === "pagas") return estado === "pago";
    if (f === "sem-contrato") return estado === "sem-contrato";
    return true;
  };

  const lista = ordenarPorUrgencia(
    linhas.filter((l) => {
      if (busca && !`${l.name} ${l.slug}`.toLowerCase().includes(busca))
        return false;
      return combina(l, filtro);
    }),
    hoje,
  );

  const contagem = (f: Filtro) => linhas.filter((l) => combina(l, f)).length;

  // Os números do topo saem das mesmas linhas — nenhuma consulta a mais.
  const soma = (quais: (typeof linhas)[number][]) =>
    quais.reduce((t, l) => t + Number(l.valor ?? 0), 0);

  const pagas = linhas.filter((l) => estadoCobranca(l, hoje) === "pago");
  const abertas = linhas.filter((l) => emAberto(estadoCobranca(l, hoje)));
  const atrasadas = linhas.filter(
    (l) => estadoCobranca(l, hoje) === "atrasado",
  );

  // Receita recorrente: o que os contratos ativos valem hoje, tenha o mês sido
  // gerado ou não. É a única linha do topo que não olha para as cobranças.
  const mrr = linhas
    .filter((l) => l.situacao === "ativo")
    .reduce((t, l) => t + Number(l.valor_vigente ?? 0), 0);

  const geradas = linhas.filter((l) => l.cobranca_id).length;
  const aGerar = linhas.filter(
    (l) => !l.cobranca_id && l.situacao === "ativo" && l.valor_vigente !== null,
  ).length;

  const comFiltro = (extra: Record<string, string | undefined>) => {
    const params = new URLSearchParams({ mes });
    if (searchParams.q) params.set("q", searchParams.q);
    if (filtro !== "todas") params.set("filtro", filtro);
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    return `/agencia/financeiro?${params}`;
  };

  return (
    <AgenciaShell
      secao="financeiro"
      migalha={[{ rotulo: "Financeiro" }]}
      titulo={nomeDoMes(mes)}
      acoes={
        aGerar > 0 ? (
          <form action={gerarCobrancas}>
            <input type="hidden" name="mes" value={mes} />
            <BotaoEnviar tamanho="sm" pendente="Gerando…">
              Gerar {aGerar} {aGerar === 1 ? "cobrança" : "cobranças"}
            </BotaoEnviar>
          </form>
        ) : null
      }
    >
      {searchParams.erro ? (
        <div className="mb-5">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Mensalidades ativas" valor={reais(mrr)} />
        <Numero
          rotulo={`Recebido em ${mesCurto(mes)}`}
          valor={reais(soma(pagas))}
          tom={pagas.length ? "bom" : "neutro"}
          alerta={
            pagas.length
              ? `${pagas.length} de ${geradas || "—"} cobranças`
              : undefined
          }
        />
        <Numero
          rotulo="Em aberto"
          valor={reais(soma(abertas))}
          tom={abertas.length ? "alerta" : "neutro"}
        />
        <Numero
          rotulo="Atrasado"
          valor={reais(soma(atrasadas))}
          tom={atrasadas.length ? "alerta" : "neutro"}
          alerta={
            atrasadas.length
              ? `${atrasadas.length} ${atrasadas.length === 1 ? "empresa" : "empresas"}`
              : undefined
          }
        />
      </div>

      <div className="mb-4 mt-5 flex flex-wrap items-center gap-2.5">
        {/* Navegação de mês: dois links e um rótulo. Um seletor de data para
            andar um mês seria três cliques onde cabe um. */}
        <div className="flex items-center gap-1">
          <Link
            href={comFiltro({ mes: deslocarMes(mes, -1) })}
            aria-label="Mês anterior"
            className={botaoEstilo("secundario", "sm")}
          >
            ‹
          </Link>
          <span className="min-w-[74px] text-center text-sm font-semibold tabular">
            {mesCurto(mes)}
          </span>
          <Link
            href={comFiltro({ mes: deslocarMes(mes, 1) })}
            aria-label="Próximo mês"
            className={botaoEstilo("secundario", "sm")}
          >
            ›
          </Link>
        </div>

        <form className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <input type="hidden" name="mes" value={mes} />
          {filtro !== "todas" ? (
            <input type="hidden" name="filtro" value={filtro} />
          ) : null}
          <label htmlFor="q" className="sr-only">
            Buscar empresa
          </label>
          <input
            id="q"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Buscar empresa…"
            className="min-h-9 w-full rounded-md border border-line-strong bg-surface-1 px-3 py-1.5 text-sm outline-none transition placeholder:text-dim focus:border-brand"
          />
        </form>

        <div className="flex overflow-x-auto rounded-md border border-line bg-surface-1 p-0.5">
          {FILTROS.map((f) => {
            const params = new URLSearchParams({ mes });
            if (searchParams.q) params.set("q", searchParams.q);
            if (f.chave !== "todas") params.set("filtro", f.chave);
            return (
              <Link
                key={f.chave}
                href={`/agencia/financeiro?${params}`}
                className={`whitespace-nowrap rounded px-2.5 py-1.5 text-xs font-semibold transition ${
                  filtro === f.chave
                    ? "bg-surface-3 text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {f.rotulo}
                <span className="ml-1.5 tabular text-dim">
                  {contagem(f.chave)}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {lista.length === 0 ? (
        <Vazio
          titulo={
            busca
              ? `Nenhuma empresa com “${searchParams.q}”`
              : filtro === "atrasadas"
                ? "Ninguém em atraso"
                : filtro === "aberto"
                  ? `Nada em aberto em ${mesCurto(mes)}`
                  : filtro === "pagas"
                    ? `Nenhum pagamento registrado em ${mesCurto(mes)}`
                    : filtro === "sem-contrato"
                      ? "Toda empresa tem contrato cadastrado"
                      : "Nenhuma empresa cadastrada"
          }
          descricao={
            filtro === "todas" && !busca && aGerar > 0
              ? `${nomeDoMes(mes)} ainda não foi gerado.`
              : undefined
          }
          acao={
            filtro === "todas" && !busca && aGerar > 0 ? (
              <form action={gerarCobrancas}>
                <input type="hidden" name="mes" value={mes} />
                <BotaoEnviar pendente="Gerando…">
                  Gerar {aGerar} {aGerar === 1 ? "cobrança" : "cobranças"}
                </BotaoEnviar>
              </form>
            ) : undefined
          }
        />
      ) : (
        <>
          {geradas === 0 && aGerar > 0 ? (
            <div className="mb-4">
              <Aviso tom="atencao">
                {nomeDoMes(mes)} ainda não foi gerado — os valores abaixo são os
                dos contratos, não cobranças lançadas.
              </Aviso>
            </div>
          ) : null}
          <TabelaFinanceiro linhas={lista} mes={mes} hoje={hoje} />
        </>
      )}
    </AgenciaShell>
  );
}
