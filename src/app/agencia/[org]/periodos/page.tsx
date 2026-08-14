import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import {
  GRUPOS_PERIODO,
  CAMPOS_PERIODO,
  nomeDoMes,
  primeiroDiaDoMes,
} from "@/lib/periodos";
import type { DashboardPeriod, Org } from "@/types/db";
import { salvarPeriodo, apagarPeriodo } from "./actions";

export const dynamic = "force-dynamic";

/**
 * Fechamento do mês — a tela que a agência mais usa.
 *
 * Substitui o `periods.html` do projeto antigo. Uma diferença de propósito: lá
 * os campos de dinheiro tinham um input estilo caixa eletrônico (digita da
 * direita para a esquerda) que precisava de JS e ainda assim se atrapalhava com
 * colagem em formato americano. Aqui é `type="number"` puro — sem JS, e o
 * navegador já valida.
 */
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
  const mesEditado = searchParams.mes
    ? primeiroDiaDoMes(searchParams.mes)
    : null;
  const emEdicao = mesEditado
    ? (lista.find((p) => p.period_date === mesEditado) ?? null)
    : null;

  // Mês novo sugerido: o seguinte ao último fechado, ou o mês corrente.
  const proximo = (() => {
    if (!lista.length) return new Date().toISOString().slice(0, 7);
    const [ano, mes] = lista[0].period_date.split("-").map(Number);
    const d = new Date(Date.UTC(ano, mes, 1));
    return d.toISOString().slice(0, 7);
  })();

  const valor = (coluna: string) => {
    if (!emEdicao) return "";
    const v = (emEdicao as unknown as Record<string, unknown>)[coluna];
    return v === null || v === undefined ? "" : String(v);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            {org.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Resultados por mês</h1>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/agencia" className="text-muted hover:text-foreground">
            Empresas
          </Link>
          <Link
            href={`/dashboard?org=${org.id}`}
            className="text-muted hover:text-foreground"
          >
            Ver o dashboard →
          </Link>
        </div>
      </header>

      {searchParams.erro ? (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {searchParams.erro}
        </p>
      ) : null}
      {searchParams.ok ? (
        <p className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          Salvo.
        </p>
      ) : null}

      {/* ── Meses já fechados ─────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-medium">
          Meses fechados{" "}
          <span className="text-sm text-muted">({lista.length})</span>
        </h2>

        {lista.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            Nenhum mês publicado. Enquanto não houver o primeiro, o cliente vê o
            card do dashboard como “em configuração”.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/10 rounded-lg border border-white/15 bg-white/5">
            {lista.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div>
                  <span className="text-sm">{nomeDoMes(p.period_date)}</span>
                  <span className="ml-3 text-xs text-muted">
                    {p.fat_total !== null
                      ? `R$ ${Number(p.fat_total).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}`
                      : "sem faturamento"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Link
                    href={`/agencia/${org.id}/periodos?mes=${p.period_date}`}
                    className="text-muted hover:text-foreground"
                  >
                    Editar
                  </Link>
                  <form action={apagarPeriodo}>
                    <input type="hidden" name="org_id" value={org.id} />
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-muted transition hover:text-red-300"
                    >
                      Apagar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Formulário ────────────────────────────────────────────────── */}
      <section className="mt-10 rounded-lg border border-white/15 bg-white/5 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-lg font-medium">
            {emEdicao
              ? `Editando ${nomeDoMes(emEdicao.period_date)}`
              : "Novo mês"}
          </h2>
          {emEdicao ? (
            <Link
              href={`/agencia/${org.id}/periodos`}
              className="text-sm text-muted hover:text-foreground"
            >
              Cancelar edição
            </Link>
          ) : null}
        </div>

        <form action={salvarPeriodo} className="mt-5 space-y-8">
          <input type="hidden" name="org_id" value={org.id} />

          <div>
            <label className="text-xs uppercase tracking-wider text-muted">
              Mês
            </label>
            <input
              type="month"
              name="period_date"
              required
              defaultValue={
                emEdicao ? emEdicao.period_date.slice(0, 7) : proximo
              }
              readOnly={Boolean(emEdicao)}
              className={`${campoClasse} mt-2 sm:w-48`}
            />
            {emEdicao ? (
              <p className="mt-2 text-xs text-muted">
                Para lançar outro mês, cancele a edição.
              </p>
            ) : null}
          </div>

          {GRUPOS_PERIODO.map((grupo) => (
            <fieldset key={grupo.titulo}>
              <legend className="text-xs uppercase tracking-wider text-muted">
                {grupo.titulo}
              </legend>
              {grupo.ajuda ? (
                <p className="mt-1 text-xs text-muted">{grupo.ajuda}</p>
              ) : null}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {grupo.campos.map((campo) => (
                  <label key={campo.coluna} className="block text-sm">
                    <span className="text-muted">{campo.rotulo}</span>
                    <input
                      name={campo.coluna}
                      type="number"
                      inputMode="decimal"
                      step={campo.tipo === "dinheiro" ? "0.01" : "1"}
                      min="0"
                      defaultValue={valor(campo.coluna)}
                      placeholder="—"
                      className={`${campoClasse} mt-1`}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-muted">
              Observações do mês
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="text-muted">Anotação interna</span>
                <textarea
                  name="obs_raw"
                  rows={4}
                  defaultValue={emEdicao?.obs_raw ?? ""}
                  className={`${campoClasse} mt-1`}
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted">Texto que o cliente lê</span>
                <textarea
                  name="obs_polished"
                  rows={4}
                  defaultValue={emEdicao?.obs_polished ?? ""}
                  className={`${campoClasse} mt-1`}
                />
              </label>
            </div>
          </fieldset>

          <button type="submit" className={`${botaoClasse} sm:w-auto sm:px-6`}>
            {emEdicao ? "Salvar alterações" : "Publicar mês"}
          </button>
        </form>
      </section>

      <p className="mt-6 text-xs text-muted">
        Campo em branco fica vazio no dashboard; zero é zero de verdade. São{" "}
        {CAMPOS_PERIODO.length} campos por mês.
      </p>
    </main>
  );
}
