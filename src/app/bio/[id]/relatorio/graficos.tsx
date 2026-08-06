"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Uma medida só (cliques) em cada gráfico, então uma cor só: identidade fica no
 * eixo, não na cor. `#e8500f` é o laranja da marca puxado para dentro da faixa
 * de luminosidade de tema escuro (OKLCH L 0.48–0.67) — passa nos seis testes
 * contra o fundo #0b0d12, incluindo daltonismo e contraste.
 */
const COR = "#e8500f";
const GRADE = "rgba(255,255,255,0.06)";
const TINTA = "#8a93a6";

function Balao({
  active,
  payload,
  sufixo,
}: {
  active?: boolean;
  payload?: { payload: { nome: string; cliques: number } }[];
  sufixo: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-white/15 bg-[#12151c] px-3 py-2 shadow-lg">
      <p className="text-[11px] uppercase tracking-wider text-muted">{p.nome}</p>
      <p className="mt-1 text-sm font-medium tabular-nums">
        {p.cliques.toLocaleString("pt-BR")} {sufixo}
      </p>
    </div>
  );
}

export function CliquesPorDia({
  dados,
}: {
  dados: { nome: string; cliques: number }[];
}) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="grad-cliques" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COR} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRADE} vertical={false} />
          <XAxis
            dataKey="nome"
            tickLine={false}
            axisLine={false}
            tick={{ fill: TINTA, fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={24}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
            tick={{ fill: TINTA, fontSize: 11 }}
          />
          <Tooltip
            content={<Balao sufixo="cliques" />}
            cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="cliques"
            stroke={COR}
            strokeWidth={2}
            fill="url(#grad-cliques)"
            dot={false}
            activeDot={{ r: 5, fill: "#0b0d12", stroke: COR, strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CliquesPorBotao({
  dados,
}: {
  dados: { nome: string; cliques: number }[];
}) {
  // Barra deitada porque o rótulo é frase ("Peça no delivery"), não sigla.
  const altura = Math.max(140, dados.length * 44 + 24);

  return (
    <div style={{ height: altura }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={dados}
          layout="vertical"
          margin={{ top: 4, right: 44, bottom: 4, left: 4 }}
          barCategoryGap={8}
        >
          <CartesianGrid stroke={GRADE} horizontal={false} />
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="nome"
            tickLine={false}
            axisLine={false}
            width={150}
            tick={{ fill: TINTA, fontSize: 12 }}
          />
          <Tooltip
            content={<Balao sufixo="cliques" />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar dataKey="cliques" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {dados.map((d) => (
              <Cell key={d.nome} fill={COR} />
            ))}
            <LabelList
              dataKey="cliques"
              position="right"
              className="fill-[#f5f6f8]"
              style={{ fontSize: 12, fontVariantNumeric: "tabular-nums" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
