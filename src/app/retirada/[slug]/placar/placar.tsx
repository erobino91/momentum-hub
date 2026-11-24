"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/*
 * Visual da BB Onça, não do portal: laranja da onça, creme do selo e preto da
 * Black. As cores são literais de propósito — esta tela veste o cliente, como a
 * página pública do bio.
 */
const LARANJA = "#F7A11A";
const CREME = "#FED094";
const LOGO =
  "https://static.goomer.app/stores/57824/products/mobile_menu/templates/390216/logo_v1669997070.png";

type Dados = { pedidos: number; lanches: number; meta: number } | null;

/** Sobe o número até o valor novo em vez de trocar de uma vez. */
function useContador(alvo: number) {
  const [valor, setValor] = useState(0);
  const atual = useRef(0);
  useEffect(() => {
    const de = atual.current;
    const t0 = performance.now();
    const dur = Math.min(1800, 400 + Math.abs(alvo - de) * 8);
    let id = 0;
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const v = Math.round(de + (alvo - de) * (1 - Math.pow(1 - k, 3)));
      atual.current = v;
      setValor(v);
      if (k < 1) id = requestAnimationFrame(passo);
    };
    id = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(id);
  }, [alvo]);
  return valor;
}

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function Placar({ dados, fonte }: { dados: Dados; fonte: string }) {
  const router = useRouter();
  // Placar fica aberto em TV: busca de novo a cada 30s, sem ninguém tocar.
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 30_000);
    return () => clearInterval(id);
  }, [router]);

  const lanches = useContador(dados?.lanches ?? 0);
  const meta = dados?.meta ?? 1000;
  const pct = Math.min(100, ((dados?.lanches ?? 0) / meta) * 100);
  const faltam = Math.max(0, meta - (dados?.lanches ?? 0));

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-between overflow-hidden px-5 py-[4vh] text-center"
      style={{
        color: CREME,
        background: `radial-gradient(ellipse at 50% 40%, #2a1a05 0%, #0b0806 55%, #000 100%)`,
      }}
    >
      {/* listras da onça, bem apagadas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `repeating-linear-gradient(115deg, ${LARANJA} 0 14px, transparent 14px 90px)`,
        }}
      />

      <header className="relative flex flex-col items-center gap-[1.5vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="BB Onça Burguer's" className="h-[13vh] w-[13vh] drop-shadow-2xl" />
        <div
          className={`${fonte} rounded-full px-5 py-1 text-[clamp(14px,2.6vh,28px)] tracking-[0.25em] text-black`}
          style={{ background: LARANJA }}
        >
          BLACK BB ONÇA
        </div>
      </header>

      <main className="relative flex flex-col items-center">
        <div
          className={`${fonte} leading-[0.85] tabular-nums`}
          style={{
            // 3 dígitos ocupam 42vw; "1.000" encolhe para caber no celular.
            fontSize: `min(${126 / Math.max(3, fmt(lanches).length)}vw, 38vh)`,
            color: LARANJA,
            textShadow: `0 0 60px ${LARANJA}55, 0 8px 0 #000`,
          }}
        >
          {fmt(lanches)}
        </div>
        <div className={`${fonte} mt-[1vh] text-[clamp(26px,6.5vh,72px)] uppercase leading-none tracking-wide`}>
          Mufasas vendidos
        </div>
        {!dados && (
          <div className="mt-3 text-sm opacity-70">Atualizando… o número volta em instantes.</div>
        )}
      </main>

      <footer className="relative w-full max-w-3xl">
        <div className="mb-2 flex items-end justify-between text-left">
          <div>
            <div className={`${fonte} text-[clamp(22px,4.5vh,48px)] leading-none tabular-nums`}>
              {fmt(dados?.pedidos ?? 0)}
            </div>
            <div className="text-[clamp(11px,1.6vh,16px)] uppercase tracking-widest opacity-70">pedidos</div>
          </div>
          <div className="text-right">
            <div className={`${fonte} text-[clamp(22px,4.5vh,48px)] leading-none tabular-nums`}>
              META {fmt(meta)}
            </div>
            <div className="text-[clamp(11px,1.6vh,16px)] uppercase tracking-widest opacity-70">
              {faltam > 0 ? `faltam ${fmt(faltam)}` : "meta batida!"}
            </div>
          </div>
        </div>
        <div className="h-[clamp(16px,3vh,32px)] w-full overflow-hidden rounded-full border-2" style={{ borderColor: `${CREME}55`, background: "#1a1208" }}>
          <div
            className="h-full rounded-full transition-[width] duration-1000 ease-out"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${CREME}, ${LARANJA})`,
              boxShadow: `0 0 24px ${LARANJA}`,
            }}
          />
        </div>
        <div className={`${fonte} mt-1 text-[clamp(14px,2.4vh,26px)] tabular-nums`} style={{ color: LARANJA }}>
          {pct.toFixed(0)}%
        </div>
      </footer>
    </div>
  );
}
