import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { nomeDoMes, primeiroDiaDoMes, CAMPOS_PERIODO } from "@/lib/periodos";
import { formatarDinheiro } from "@/lib/numero";
import type { DashboardPeriod, Org } from "@/types/db";
import { salvarPeriodo, apagarPeriodo } from "./actions";
import { FormularioPeriodo } from "./formulario";
import { AgenciaShell } from "@/components/shell";
import { AbasEmpresa } from "@/components/agencia/abas";
import {
  Aviso,
  Cartao,
  ConfirmarAcao,
  Selo,
  Vazio,
  botaoEstilo,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resultados por mês" };

/** Colunas do período viram texto para o formulário, que trabalha em texto. */
function comoTexto(p: DashboardPeriod | null): Record<string, string> {
  if (!p) return {};
  const linha = p as unknown as Record<string, unknown>;
  return Object.fromEntries(
    CAMPOS_PERIODO.map((c) => {
      const v = linha[c.coluna];
      if (v === null || v === undefined) return [c.coluna, ""];
      return [
        c.coluna,
        c.tipo === "dinheiro"
          ? formatarDinheiro(Number(v))
          : String(Math.round(Number(v))),
      ];
    }),
  );
}

export default async function PeriodosPage({
  params,
  searchParams,
}: {
  params: { org: string };
  searchParams: { mes?: string; erro?: string; ok?: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data: org } = await supabase
    .from("orgs")
    .select("id,name,slug")
    .eq("id", params.org)
    .maybeSingle<Pick<Org, "id" | "name" | "slug">>();
  if (!org) redirect("/agencia");

  const { data: periodos } = await supabase
    .from("dashboard_periods")
    .select("*")
    .eq("org_id", org.id)
    .order("period_date", { ascending: false })
    .returns<DashboardPeriod[]>();

  const lista = periodos ?? [];
  const mesEditado = searchParams.mes ? primeiroDiaDoMes(searchParams.mes) : null;
  const emEdicao = mesEditado
    ? (lista.find((p) => p.period_date === mesEditado) ?? null)
    : null;

  // Mês novo sugerido: o seguinte ao último fechado, ou o mês corrente.
  const proximo = (() => {
    if (!lista.length) return new Date().toISOString().slice(0, 7);
    const [ano, mes] = lista[0].period_date.split("-").map(Number);
    return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 7);
  })();

  // O mês imediatamente anterior ao que está sendo mexido — só para sugerir
  // valor embaixo de cada campo.
  const anterior = emEdicao
    ? (lista.find((p) => p.period_date < emEdicao.period_date) ?? null)
    : (lista[0] ?? null);

  const totalDe = (p: DashboardPeriod) =>
    Number(p.fat_mesa ?? 0) + Number(p.fat_delivery ?? 0) + Number(p.fat_ifood ?? 0);

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[
        { rotulo: "Empresas", href: "/agencia" },
        { rotulo: org.name, href: `/agencia/${org.id}` },
        { rotulo: "Resultados" },
      ]}
      titulo={
        emEdicao ? `Editando ${nomeDoMes(emEdicao.period_date)}` : "Fechamento do mês"
      }
      acoes={
        <Link
          href={`/dashboard?org=${org.id}`}
          className={botaoEstilo("secundario", "sm")}
        >
          Ver o dashboard
        </Link>
      }
    >
      <AbasEmpresa orgId={org.id} ativa="resultados" />

      {searchParams.erro ? (
        <div className="mb-5">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}
      {searchParams.ok ? (
        <div className="mb-5">
          <Aviso tom="ok">Mês salvo e publicado no dashboard do cliente.</Aviso>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="lg:order-1">
          <FormularioPeriodo
            orgId={org.id}
            acao={salvarPeriodo}
            valoresIniciais={comoTexto(emEdicao)}
            anterior={comoTexto(anterior)}
            mesAnterior={anterior?.period_date ?? null}
            mesSugerido={proximo}
            editando={emEdicao?.period_date ?? null}
            obsRaw={emEdicao?.obs_raw ?? ""}
            obsPolished={emEdicao?.obs_polished ?? ""}
            cancelar={
              emEdicao ? (
                <Link
                  href={`/agencia/${org.id}/periodos`}
                  className={botaoEstilo("fantasma")}
                >
                  Cancelar edição
                </Link>
              ) : null
            }
          />
        </div>

        {/* ── Meses já publicados ─────────────────────────────────────── */}
        <aside className="lg:order-2">
          <Cartao
            titulo="Meses publicados"
            acao={<Selo tom={lista.length ? "pronto" : "atencao"}>{lista.length}</Selo>}
          >
            {lista.length === 0 ? (
              <Vazio
                titulo="Nenhum mês ainda"
                descricao="Enquanto não houver o primeiro, o cliente vê o dashboard como “em configuração”."
              />
            ) : (
              <ul className="-mx-1 space-y-0.5">
                {lista.map((p) => {
                  const atual = p.period_date === emEdicao?.period_date;
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-2 rounded-md px-2 py-2 ${
                        atual ? "bg-brand/15" : "hover:bg-surface-2"
                      }`}
                    >
                      <Link
                        href={`/agencia/${org.id}/periodos?mes=${p.period_date}`}
                        className="min-w-0 flex-1"
                      >
                        <span className="block text-sm font-medium">
                          {nomeDoMes(p.period_date)}
                        </span>
                        <span className="block text-xs tabular text-dim">
                          R$ {formatarDinheiro(totalDe(p))}
                        </span>
                      </Link>
                      <ConfirmarAcao
                        acao={apagarPeriodo}
                        rotulo="Apagar"
                        titulo={`Apagar ${nomeDoMes(p.period_date)}?`}
                        descricao={
                          <>
                            Os números do mês somem do dashboard de{" "}
                            <strong className="text-foreground">{org.name}</strong>{" "}
                            na hora. Não dá para desfazer.
                          </>
                        }
                        confirmar="Apagar mês"
                        digite={nomeDoMes(p.period_date).split("/")[0]}
                      >
                        <input type="hidden" name="org_id" value={org.id} />
                        <input type="hidden" name="id" value={p.id} />
                      </ConfirmarAcao>
                    </li>
                  );
                })}
              </ul>
            )}
          </Cartao>
        </aside>
      </div>
    </AgenciaShell>
  );
}
