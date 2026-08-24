import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import { precos, formatarBRL } from "@/lib/precificacao";
import type { Org, PricingConfig, PricingProduct } from "@/types/db";
import {
  salvarVariaveis,
  criarProduto,
  atualizarPreco,
  apagarProduto,
} from "./actions";

import { AgenciaShell } from "@/components/shell";
import { Aviso } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Precificação iFood" };

/**
 * Precificação iFood — ferramenta interna, o cliente não tem esta tela nem lê
 * estas tabelas (a RLS é `is_agency()` nas duas).
 *
 * A conta é a mesma do `pricing.html` antigo, sem mudança nenhuma.
 */
export default async function PrecificacaoPage({
  params,
  searchParams,
}: {
  params: { org: string };
  searchParams: { erro?: string; q?: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data: org } = await supabase
    .from("orgs")
    .select("id,name")
    .eq("id", params.org)
    .maybeSingle<Pick<Org, "id" | "name">>();
  if (!org) redirect("/agencia");

  const [{ data: cfg }, { data: produtos }] = await Promise.all([
    supabase
      .from("pricing_config")
      .select("*")
      .eq("org_id", org.id)
      .maybeSingle<PricingConfig>(),
    supabase
      .from("pricing_products")
      .select("*")
      .eq("org_id", org.id)
      .order("name")
      .returns<PricingProduct[]>(),
  ]);

  const variaveis = {
    taxa_extra: Number(cfg?.taxa_extra ?? 0),
    campanha: Number(cfg?.campanha ?? 0),
    entrega: Number(cfg?.entrega ?? 0),
    cupom: Number(cfg?.cupom ?? 0),
  };

  const busca = (searchParams.q ?? "").toLowerCase();
  const lista = (produtos ?? []).filter((p) =>
    busca ? p.name.toLowerCase().includes(busca) : true,
  );

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[
        { rotulo: "Empresas", href: "/agencia" },
        { rotulo: org.name, href: "/agencia" },
        { rotulo: "Precificação" },
      ]}
      titulo="Precificação iFood"
    >
      <p className="-mt-1 mb-6 text-sm text-muted">
        Preço de balcão + o que a plataforma come, em três fases.
      </p>

      {searchParams.erro ? (
        <div className="mb-6">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      {/* ── Variáveis ─────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-white/15 bg-white/5 p-5">
        <h2 className="text-lg font-medium">Variáveis</h2>
        <form action={salvarVariaveis} className="mt-4 grid gap-3 sm:grid-cols-5">
          <input type="hidden" name="org_id" value={org.id} />
          <label className="block text-sm">
            <span className="text-muted">Taxa extra (%)</span>
            <input
              name="taxa_extra"
              type="number"
              step="0.01"
              min="0"
              defaultValue={variaveis.taxa_extra}
              className={`${campoClasse} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Campanha (R$)</span>
            <input
              name="campanha"
              type="number"
              step="0.01"
              min="0"
              defaultValue={variaveis.campanha}
              className={`${campoClasse} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Entrega grátis (R$)</span>
            <input
              name="entrega"
              type="number"
              step="0.01"
              min="0"
              defaultValue={variaveis.entrega}
              className={`${campoClasse} mt-1`}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Cupom (R$)</span>
            <input
              name="cupom"
              type="number"
              step="0.01"
              min="0"
              defaultValue={variaveis.cupom}
              className={`${campoClasse} mt-1`}
            />
          </label>
          <button type="submit" className={`${botaoClasse} self-end`}>
            Recalcular
          </button>
        </form>
      </section>

      {/* ── Produtos ──────────────────────────────────────────────────── */}
      <section className="mt-8 rounded-lg border border-white/15 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-medium">
            Produtos <span className="text-sm text-muted">({lista.length})</span>
          </h2>
          <form className="flex gap-2">
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Filtrar por nome…"
              className={`${campoClasse} sm:w-56`}
            />
          </form>
        </div>

        <form action={criarProduto} className="mt-4 flex flex-wrap gap-3">
          <input type="hidden" name="org_id" value={org.id} />
          <input
            name="name"
            required
            placeholder="Nome do produto"
            className={`${campoClasse} sm:w-72`}
          />
          <input
            name="preco_balcao"
            required
            type="number"
            step="0.01"
            min="0"
            placeholder="Preço balcão"
            className={`${campoClasse} sm:w-40`}
          />
          <button type="submit" className={`${botaoClasse} sm:w-auto sm:px-5`}>
            Cadastrar
          </button>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr className="border-b border-white/10">
                <th className="py-2 text-left font-normal">Produto</th>
                <th className="py-2 text-right font-normal">Balcão</th>
                <th className="py-2 text-right font-normal">Fase 1</th>
                <th className="py-2 text-right font-normal">Fase 2</th>
                <th className="py-2 text-right font-normal">Fase 3</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {lista.map((p) => {
                const { f1, f2, f3, pct } = precos(
                  Number(p.preco_balcao),
                  variaveis,
                );
                const cor =
                  pct >= 38
                    ? "text-emerald-300"
                    : pct >= 25
                      ? "text-amber-300"
                      : "text-red-300";
                return (
                  <tr key={p.id}>
                    <td className="py-2 pr-3">{p.name}</td>
                    <td className="py-2 text-right">
                      <form
                        action={atualizarPreco}
                        className="flex justify-end gap-2"
                      >
                        <input type="hidden" name="org_id" value={org.id} />
                        <input type="hidden" name="id" value={p.id} />
                        <input
                          name="preco_balcao"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={Number(p.preco_balcao)}
                          className={`${campoClasse} w-28 text-right`}
                        />
                        <button
                          type="submit"
                          className="text-xs text-muted hover:text-foreground"
                        >
                          ok
                        </button>
                      </form>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatarBRL(f1)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatarBRL(f2)}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <span className="font-medium">{formatarBRL(f3)}</span>{" "}
                      <span className={`text-xs ${cor}`}>
                        {pct >= 0 ? "+" : ""}
                        {pct.toFixed(1).replace(".", ",")}%
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <form action={apagarProduto}>
                        <input type="hidden" name="org_id" value={org.id} />
                        <input type="hidden" name="id" value={p.id} />
                        <button
                          type="submit"
                          className="text-xs text-muted transition hover:text-red-300"
                        >
                          remover
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {lista.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            {busca
              ? `Nenhum produto com “${searchParams.q}”.`
              : "Nenhum produto cadastrado."}
          </p>
        ) : null}
      </section>
    </AgenciaShell>
  );
}
