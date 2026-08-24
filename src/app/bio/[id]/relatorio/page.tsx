import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LinkPage } from "@/types/bio";
import { CliquesPorBotao, CliquesPorDia } from "./graficos";

export const metadata = { title: "Relatório de cliques" };

export const dynamic = "force-dynamic";

const FUSO = "America/Sao_Paulo";
const JANELAS = [7, 30, 90] as const;

/** Dia no fuso de Brasília — senão um clique das 22h vira o dia seguinte. */
function diaLocal(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO });
}

function rotuloCurto(dia: string) {
  return dia.slice(0, 5); // dd/mm
}

export default async function RelatorioPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { d?: string };
}) {
  const dias = JANELAS.includes(Number(searchParams.d) as (typeof JANELAS)[number])
    ? Number(searchParams.d)
    : 30;

  const supabase = createClient();

  const { data: pagina } = await supabase
    .from("link_pages")
    .select("id, slug, title")
    .eq("id", params.id)
    .maybeSingle<Pick<LinkPage, "id" | "slug" | "title">>();
  if (!pagina) redirect("/bio");

  const desde = new Date(Date.now() - (dias - 1) * 86400000);
  desde.setUTCHours(0, 0, 0, 0);

  // Volume de MVP: os cliques do período vêm crus e a soma é feita aqui. Se um
  // dia passar do teto, a conta migra para uma RPC de agregação no banco.
  const { data: cliques } = await supabase
    .from("link_clicks")
    .select("rotulo, clicked_at")
    .eq("page_id", pagina.id)
    .gte("clicked_at", desde.toISOString())
    .order("clicked_at")
    .limit(10000)
    .returns<{ rotulo: string | null; clicked_at: string }[]>();

  const linhas = cliques ?? [];

  const porBotao = new Map<string, number>();
  const porDia = new Map<string, number>();
  for (const c of linhas) {
    const nome = c.rotulo ?? "(botão apagado)";
    porBotao.set(nome, (porBotao.get(nome) ?? 0) + 1);
    const dia = diaLocal(c.clicked_at);
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }

  // Dia sem clique também é informação: entra com zero em vez de sumir do eixo.
  const serieDias: { nome: string; cliques: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString("pt-BR", {
      timeZone: FUSO,
    });
    serieDias.push({ nome: rotuloCurto(d), cliques: porDia.get(d) ?? 0 });
  }

  const serieBotoes = Array.from(porBotao, ([nome, cliques]) => ({
    nome,
    cliques,
  })).sort((a, b) => b.cliques - a.cliques);

  const total = linhas.length;
  const campeao = serieBotoes[0];
  const diasComClique = Array.from(porDia.values()).filter((n) => n > 0).length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Relatório de cliques
          </p>
          <h1 className="mt-2 truncate text-3xl font-semibold">{pagina.title}</h1>
        </div>
        <Link
          href={`/bio/${pagina.id}`}
          className="text-sm text-muted hover:text-foreground"
        >
          Voltar ao editor
        </Link>
      </header>

      <div className="mt-8 flex flex-wrap gap-2">
        {JANELAS.map((j) => (
          <Link
            key={j}
            href={`/bio/${pagina.id}/relatorio?d=${j}`}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              j === dias
                ? "border-brand bg-brand/15 text-foreground"
                : "border-line-strong text-muted hover:text-foreground"
            }`}
          >
            {j} dias
          </Link>
        ))}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-line bg-surface-1 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Cliques no período
          </p>
          <p className="mt-1 text-2xl font-medium tabular-nums">
            {total.toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface-1 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Botão mais clicado
          </p>
          <p className="mt-1 truncate text-lg font-medium">
            {campeao ? campeao.nome : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface-1 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Dias com clique
          </p>
          <p className="mt-1 text-2xl font-medium tabular-nums">
            {diasComClique} <span className="text-base text-muted">de {dias}</span>
          </p>
        </div>
      </section>

      {total === 0 ? (
        <p className="mt-8 rounded-lg border border-line-strong bg-surface-1 px-4 py-6 text-sm text-muted">
          Nenhum clique registrado nesse período.
        </p>
      ) : (
        <>
          <section className="mt-6 rounded-xl border border-line bg-surface-1 p-5">
            <h2 className="mb-4 text-[13px] font-bold text-muted">
              Cliques por dia
            </h2>
            <CliquesPorDia dados={serieDias} />
          </section>

          <section className="mt-3 rounded-xl border border-line bg-surface-1 p-5">
            <h2 className="mb-4 text-[13px] font-bold text-muted">
              Cliques por botão
            </h2>
            <CliquesPorBotao dados={serieBotoes} />
          </section>

          {/* Mesma informação em texto — o gráfico não pode ser o único caminho. */}
          <section className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface-1 p-5">
            <h2 className="mb-4 text-[13px] font-bold text-muted">Tabela</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted">
                  <th className="pb-2 font-semibold">Botão</th>
                  <th className="pb-2 text-right font-semibold">Cliques</th>
                  <th className="pb-2 text-right font-semibold">Participação</th>
                </tr>
              </thead>
              <tbody>
                {serieBotoes.map((b) => (
                  <tr key={b.nome} className="border-t border-line">
                    <td className="py-2">{b.nome}</td>
                    <td className="py-2 text-right tabular-nums">
                      {b.cliques.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted">
                      {((b.cliques / total) * 100).toFixed(1).replace(".", ",")}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
