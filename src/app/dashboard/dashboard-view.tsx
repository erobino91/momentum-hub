"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import type { DadosDashboard, PeriodoDash, SecaoDash } from "@/types/dashboard";
import { Grafico, type PontoGrafico } from "./grafico";
import {
  fmtBRL,
  fmtMes,
  fmtMesCurto,
  fmtNum,
  fmtPct,
  fmtRoas,
  n,
  razao,
  textoVariacao,
  variacao,
  type Variacao,
} from "./formato";

const COR = {
  total: "#10B981",
  mesa: "#8B5CF6",
  delivery: "#3B82F6",
  ifood: "#EF4444",
};

const FUNIL_ETAPAS = [
  "Visitas",
  "Visualizações",
  "Sacola",
  "Revisão",
  "Concluídos",
] as const;

const FUNIL_CP = [
  "cp_visitas",
  "cp_views",
  "cp_sacola",
  "cp_revisao",
  "cp_concluidos",
] as const;

const FUNIL_IF = [
  "if_visitas",
  "if_views",
  "if_sacola",
  "if_revisao",
  "if_concluidos",
] as const;

/* ────────────────────────────── peças ────────────────────────────── */

function Delta({ v }: { v: Variacao }) {
  const cor = !v
    ? "text-muted"
    : v.subiu
      ? "text-emerald-400"
      : "text-red-400";
  return <p className={`mt-1.5 text-[11px] font-semibold ${cor}`}>{textoVariacao(v)}</p>;
}

function Cartao({
  label,
  valor,
  delta,
}: {
  label: string;
  valor: string;
  delta?: Variacao;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-1 text-lg font-medium tabular-nums">{valor}</p>
      {delta !== undefined ? <Delta v={delta} /> : null}
    </div>
  );
}

function Badge({ texto, cor }: { texto: string; cor: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{ background: `${cor}22`, color: cor }}
    >
      {texto}
    </span>
  );
}

function Bloco({
  titulo,
  badge,
  children,
}: {
  titulo: string;
  badge?: { texto: string; cor: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold">
        {titulo}
        {badge ? <Badge texto={badge.texto} cor={badge.cor} /> : null}
      </h3>
      {children}
    </section>
  );
}

function TituloSecao({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 pl-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted">
      <span className="h-3.5 w-[3px] rounded-sm bg-accent" />
      {children}
    </h2>
  );
}

/**
 * Funil de conversão. A barra colorida cresce com a taxa em relação à primeira
 * etapa; o piso de 30% existe só para a etapa final não sumir — é o mesmo
 * cálculo visual do dash.html.
 */
function Funil({
  chaves,
  cor,
  atual,
  anterior,
}: {
  chaves: readonly (keyof PeriodoDash)[];
  cor: string;
  atual: PeriodoDash;
  anterior: PeriodoDash | null;
}) {
  const base = n(atual[chaves[0]]) || 1;

  return (
    <div className="flex flex-wrap gap-2">
      {chaves.map((chave, i) => {
        const valor = n(atual[chave]);
        const pct = (valor / base) * 100;
        const visivel = 30 + (pct / 100) * 70;
        const v = variacao(valor, anterior ? anterior[chave] : null);

        return (
          <div
            key={chave}
            className="flex min-w-[calc(50%-4px)] flex-1 flex-col overflow-hidden rounded-lg border border-white/10 bg-white/[0.03] sm:min-w-0"
          >
            <div className="flex-1 px-3 pb-2.5 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                {FUNIL_ETAPAS[i]}
              </p>
              <p className="mt-1 text-base font-medium tabular-nums">
                {fmtNum(valor)}
              </p>
              <p
                className={`mt-2 text-[10px] font-semibold ${
                  !v ? "text-muted" : v.subiu ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {v
                  ? `${v.subiu ? "↑" : "↓"} ${v.subiu ? "+" : ""}${fmtPct(v.pct)}`
                  : "—"}
              </p>
            </div>
            <div className="relative flex h-14 items-end justify-center overflow-hidden pb-2">
              <div
                className="absolute inset-x-0 bottom-0 transition-[height] duration-500"
                style={{
                  height: `${visivel.toFixed(2)}%`,
                  background: `linear-gradient(180deg, ${cor}cc, ${cor}55)`,
                }}
              />
              <span className="relative z-10 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm">
                {fmtPct(pct)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** `**negrito**` e quebras de linha, sem `dangerouslySetInnerHTML`. */
function Observacoes({ texto }: { texto: string }) {
  return (
    <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
      {texto.split("\n").map((linha, iLinha) => (
        <Fragment key={iLinha}>
          {iLinha > 0 ? <br /> : null}
          {linha.split(/\*\*(.+?)\*\*/g).map((parte, i) =>
            i % 2 === 1 ? (
              <strong key={i} className="font-semibold text-foreground">
                {parte}
              </strong>
            ) : (
              <Fragment key={i}>{parte}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </p>
  );
}

function BlocoTrafego({
  titulo,
  badge,
  invest,
  vendas,
  investAnterior,
  vendasAnterior,
  extras,
}: {
  titulo: string;
  badge: { texto: string; cor: string };
  invest: unknown;
  vendas: unknown;
  investAnterior: unknown;
  vendasAnterior: unknown;
  extras?: React.ReactNode;
}) {
  const roas = razao(vendas, invest);
  const roasAnterior = razao(vendasAnterior, investAnterior);

  return (
    <Bloco titulo={titulo} badge={badge}>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Cartao
          label="Valor Investido"
          valor={fmtBRL(invest)}
          delta={variacao(invest, investAnterior)}
        />
        <Cartao
          label="Valor em Vendas"
          valor={fmtBRL(vendas)}
          delta={variacao(vendas, vendasAnterior)}
        />
        <Cartao
          label="ROAS"
          valor={fmtRoas(roas)}
          delta={variacao(roas, roasAnterior)}
        />
      </div>
      {extras}
    </Bloco>
  );
}

/* ────────────────────────────── tela ────────────────────────────── */

export function DashboardView({
  dados,
  prefixoTitulo,
}: {
  dados: DadosDashboard;
  /** Preenchido quando a agência abre o dashboard de um cliente. */
  prefixoTitulo?: string;
}) {
  const { cliente, periodos } = dados;
  const [idx, setIdx] = useState(periodos.length - 1);

  const atual = periodos[idx];
  const anterior = idx > 0 ? periodos[idx - 1] : null;
  const mes = fmtMes(atual.period_date);

  const tem = (s: SecaoDash) => cliente.secoes.includes(s);
  const temReceita = tem("salao") || tem("delivery") || tem("ifood");
  const temFunis = tem("funil_cp") || tem("ifood");
  const temTrafego = tem("meta") || tem("google") || tem("crm");

  // Faturamento total é sempre recomposto das partes (nunca a coluna
  // `fat_total` do banco), igual ao dash.html.
  const fatTotal =
    n(atual.fat_mesa) + n(atual.fat_delivery) + n(atual.fat_ifood);
  const fatTotalAnterior = anterior
    ? n(anterior.fat_mesa) + n(anterior.fat_delivery) + n(anterior.fat_ifood)
    : 0;

  /** Últimos 4 meses até o selecionado. */
  const serie = useMemo(() => {
    const janela = periodos.slice(Math.max(0, idx - 3), idx + 1);
    const pontos = (valor: (p: PeriodoDash) => number): PontoGrafico[] =>
      janela.map((p) => ({
        eixo: fmtMesCurto(p.period_date),
        mes: fmtMes(p.period_date),
        valor: valor(p),
      }));

    return {
      total: pontos((p) => n(p.fat_mesa) + n(p.fat_delivery) + n(p.fat_ifood)),
      mesa: pontos((p) => n(p.fat_mesa)),
      delivery: pontos((p) => n(p.fat_delivery)),
      ifood: pontos((p) => n(p.fat_ifood)),
    };
  }, [periodos, idx]);

  const ticketMesa = razao(atual.fat_mesa, atual.pedidos_mesa);
  const ticketMesaAnterior = anterior
    ? razao(anterior.fat_mesa, anterior.pedidos_mesa)
    : 0;
  const ticketDelivery = razao(atual.fat_delivery, atual.pedidos_delivery);
  const ticketDeliveryAnterior = anterior
    ? razao(anterior.fat_delivery, anterior.pedidos_delivery)
    : 0;
  const ticketIfood = razao(atual.fat_ifood, atual.if_concluidos);
  const ticketIfoodAnterior = anterior
    ? razao(anterior.fat_ifood, anterior.if_concluidos)
    : 0;

  const obs = atual.obs_polished || atual.obs_raw || "";

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center gap-4">
          {cliente.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cliente.logoUrl}
              alt=""
              className="h-12 w-12 rounded-lg border border-white/10 bg-white/5 object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold">
              {prefixoTitulo ? `${prefixoTitulo} · ` : ""}
              {cliente.nome}
            </h1>
            <p className="mt-0.5 text-xs text-muted">{mes}</p>
          </div>
          <div className="flex-1" />
          <Link
            href="/"
            className="text-sm text-muted transition hover:text-foreground"
          >
            Voltar ao portal
          </Link>
        </div>
        <label className="flex flex-col gap-1 sm:max-w-xs">
          <span className="sr-only">Mês</span>
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium outline-none transition focus:border-accent"
          >
            {periodos.map((p, i) => (
              <option key={p.period_date} value={i} className="bg-[#12151c]">
                {fmtMes(p.period_date)}
              </option>
            ))}
          </select>
        </label>
      </header>

      {tem("faturamento") ? (
        <section className="mt-8">
          <div
            className="rounded-xl p-6 sm:p-8"
            style={{
              background:
                "linear-gradient(135deg,#064E3B 0%,#065F46 45%,#047857 100%)",
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-white/70">
              Faturamento Total
            </p>
            <p className="mt-2 text-3xl font-medium tabular-nums text-white sm:text-4xl">
              {fmtBRL(fatTotal)}
            </p>
            <p className="mt-2 text-xs font-semibold text-white/85">
              {textoVariacao(variacao(fatTotal, fatTotalAnterior))}
            </p>
            <p className="mt-1.5 text-[13px] text-white/60">
              Resultado de {mes}
            </p>
          </div>
          <div className="mt-2.5 rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <p className="mb-3 text-[13px] font-bold text-muted">
              Evolução — Faturamento Total
            </p>
            <Grafico dados={serie.total} cor={COR.total} altura={200} />
          </div>
        </section>
      ) : null}

      {temReceita ? (
        <section className="mt-8">
          <TituloSecao>Detalhamento de receita</TituloSecao>
          <div className="space-y-2.5">
            {tem("salao") ? (
              <Bloco titulo="Mesa & Salão">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Cartao
                    label="Faturamento"
                    valor={fmtBRL(atual.fat_mesa)}
                    delta={variacao(atual.fat_mesa, anterior?.fat_mesa)}
                  />
                  <Cartao
                    label="Pedidos"
                    valor={fmtNum(atual.pedidos_mesa)}
                    delta={variacao(atual.pedidos_mesa, anterior?.pedidos_mesa)}
                  />
                  <Cartao
                    label="Ticket Médio"
                    valor={fmtBRL(ticketMesa)}
                    delta={variacao(ticketMesa, ticketMesaAnterior)}
                  />
                </div>
                <p className="mb-3 mt-5 text-[13px] font-bold text-muted">
                  Evolução — Mesa & Salão
                </p>
                <Grafico dados={serie.mesa} cor={COR.mesa} />
              </Bloco>
            ) : null}

            {tem("delivery") ? (
              <Bloco titulo="Delivery Próprio">
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Cartao
                    label="Faturamento"
                    valor={fmtBRL(atual.fat_delivery)}
                    delta={variacao(atual.fat_delivery, anterior?.fat_delivery)}
                  />
                  <Cartao
                    label="Pedidos"
                    valor={fmtNum(atual.pedidos_delivery)}
                    delta={variacao(
                      atual.pedidos_delivery,
                      anterior?.pedidos_delivery,
                    )}
                  />
                  <Cartao
                    label="Ticket Médio"
                    valor={fmtBRL(ticketDelivery)}
                    delta={variacao(ticketDelivery, ticketDeliveryAnterior)}
                  />
                </div>
                <p className="mb-3 mt-5 text-[13px] font-bold text-muted">
                  Evolução — Delivery Próprio
                </p>
                <Grafico dados={serie.delivery} cor={COR.delivery} />
              </Bloco>
            ) : null}

            {tem("ifood") ? (
              <Bloco
                titulo="iFood"
                badge={{ texto: "iFood", cor: COR.ifood }}
              >
                <div className="grid gap-2.5 sm:grid-cols-3">
                  <Cartao
                    label="Faturamento"
                    valor={fmtBRL(atual.fat_ifood)}
                    delta={variacao(atual.fat_ifood, anterior?.fat_ifood)}
                  />
                  <Cartao
                    label="Pedidos"
                    valor={fmtNum(atual.if_concluidos)}
                    delta={variacao(atual.if_concluidos, anterior?.if_concluidos)}
                  />
                  <Cartao
                    label="Ticket Médio"
                    valor={fmtBRL(ticketIfood)}
                    delta={variacao(ticketIfood, ticketIfoodAnterior)}
                  />
                </div>
                <p className="mb-3 mt-5 text-[13px] font-bold text-muted">
                  Evolução — iFood
                </p>
                <Grafico dados={serie.ifood} cor={COR.ifood} />
              </Bloco>
            ) : null}
          </div>
        </section>
      ) : null}

      {temFunis ? (
        <section className="mt-8">
          <TituloSecao>Funis de conversão</TituloSecao>
          <div className="space-y-2.5">
            {tem("funil_cp") ? (
              <Bloco
                titulo="Funil — Cardápio Próprio"
                badge={{ texto: "Próprio", cor: COR.mesa }}
              >
                <Funil
                  chaves={FUNIL_CP}
                  cor={COR.mesa}
                  atual={atual}
                  anterior={anterior}
                />
              </Bloco>
            ) : null}
            {tem("ifood") ? (
              <Bloco
                titulo="Funil — iFood"
                badge={{ texto: "iFood", cor: COR.ifood }}
              >
                <Funil
                  chaves={FUNIL_IF}
                  cor={COR.ifood}
                  atual={atual}
                  anterior={anterior}
                />
              </Bloco>
            ) : null}
          </div>
        </section>
      ) : null}

      {temTrafego ? (
        <section className="mt-8">
          <TituloSecao>Resultados de tráfego</TituloSecao>
          <div className="space-y-2.5">
            <div
              className={`grid gap-2.5 ${
                tem("meta") && tem("crm") ? "lg:grid-cols-2" : ""
              }`}
            >
              {tem("meta") ? (
                <BlocoTrafego
                  titulo="Meta Ads"
                  badge={{ texto: "Meta", cor: COR.mesa }}
                  invest={atual.meta_invest}
                  vendas={atual.meta_vendas}
                  investAnterior={anterior?.meta_invest}
                  vendasAnterior={anterior?.meta_vendas}
                />
              ) : null}
              {tem("crm") ? (
                <BlocoTrafego
                  titulo="CRM — Disparos"
                  badge={{ texto: "CRM", cor: "#F59E0B" }}
                  invest={atual.crm_invest}
                  vendas={atual.crm_vendas}
                  investAnterior={anterior?.crm_invest}
                  vendasAnterior={anterior?.crm_vendas}
                />
              ) : null}
            </div>
            {tem("google") ? (
              <BlocoTrafego
                titulo="Google Ads"
                badge={{ texto: "Google", cor: COR.delivery }}
                invest={atual.google_invest}
                vendas={atual.google_vendas}
                investAnterior={anterior?.google_invest}
                vendasAnterior={anterior?.google_vendas}
                extras={
                  <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                    <Cartao
                      label="Visitas à Loja"
                      valor={fmtNum(atual.google_visitas_loja)}
                      delta={variacao(
                        atual.google_visitas_loja,
                        anterior?.google_visitas_loja,
                      )}
                    />
                    <Cartao
                      label="Obter Rota"
                      valor={fmtNum(atual.google_rotas)}
                      delta={variacao(atual.google_rotas, anterior?.google_rotas)}
                    />
                  </div>
                }
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {obs ? (
        <section className="mt-8">
          <TituloSecao>Destaques do mês</TituloSecao>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <Observacoes texto={obs} />
          </div>
        </section>
      ) : null}

      <footer className="mt-8 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Atualizado · {mes}
      </footer>
    </main>
  );
}
