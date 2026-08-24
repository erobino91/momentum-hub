"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtBRL } from "./formato";

export type PontoGrafico = {
  /** Rótulo curto do eixo — "jun/26". */
  eixo: string;
  /** Rótulo cheio do tooltip — "Junho de 2026". */
  mes: string;
  valor: number;
};

function Balao({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PontoGrafico }[];
}) {
  if (!active || !payload?.length) return null;
  const ponto = payload[0].payload;
  return (
    <div className="rounded-md border border-line-strong bg-surface-2 px-3 py-2 shadow-lg">
      <p className="text-[11px] uppercase tracking-wider text-muted">
        {ponto.mes}
      </p>
      <p className="mt-1 text-sm font-medium tabular-nums">
        {fmtBRL(ponto.valor)}
      </p>
    </div>
  );
}

/**
 * Evolução dos últimos meses. Mesma leitura do dash.html (linha suavizada com
 * área), repintada para o fundo escuro do portal.
 *
 * As cores aqui são literais, não tokens: o recharts escreve `fill` como
 * atributo de apresentação do SVG, e `var()` não é resolvido em atributo — só
 * em propriedade CSS. Os valores acompanham `globals.css` na mão.
 */
const COR_TEXTO = "#9AA3B4"; // --muted
const COR_FUNDO = "#0A0C10"; // --canvas

/** `150000` → `150 mil`. "R$ 200.000" no eixo não cabe e quebra em duas linhas. */
function tickCurto(v: number) {
  if (Math.abs(v) >= 1_000_000)
    return `${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)} mil`;
  return String(Math.round(v));
}

export function Grafico({
  dados,
  cor,
  altura = 180,
}: {
  dados: PontoGrafico[];
  cor: string;
  altura?: number;
}) {
  const id = useId().replace(/:/g, "");

  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={dados}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
              <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="eixo"
            tickLine={false}
            axisLine={false}
            tick={{ fill: COR_TEXTO, fontSize: 11 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={58}
            tick={{ fill: COR_TEXTO, fontSize: 11 }}
            tickFormatter={tickCurto}
          />
          <Tooltip
            content={<Balao />}
            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="valor"
            stroke={cor}
            strokeWidth={2.5}
            fill={`url(#${id})`}
            dot={{ r: 4, fill: COR_FUNDO, stroke: cor, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: COR_FUNDO, stroke: cor, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
