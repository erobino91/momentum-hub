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
    <div className="rounded-md border border-white/15 bg-[#12151c] px-3 py-2 shadow-lg">
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
 */
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
            tick={{ fill: "#8a93a6", fontSize: 11 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={72}
            tick={{ fill: "#8a93a6", fontSize: 11 }}
            tickFormatter={(v: number) =>
              `R$ ${Math.round(v).toLocaleString("pt-BR")}`
            }
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
            dot={{ r: 4, fill: "#0b0d12", stroke: cor, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: "#0b0d12", stroke: cor, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
