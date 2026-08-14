"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Recarrega a página a cada 5s enquanto houver live no ar.
 *
 * O painel antigo fazia polling e tinha um "mock worker" que mudava o status
 * pelo próprio navegador. Aqui só o `lives-worker` escreve status; a tela é
 * leitora, então basta buscar de novo. Realtime seria mais elegante, mas custa
 * a dança de `setAuth` antes do `subscribe()` — e para um painel interno com
 * poucas linhas, `router.refresh()` erra menos.
 */
export function AtualizacaoAutomatica({ ativa }: { ativa: boolean }) {
  const router = useRouter();
  const [atualizadoEm, setAtualizadoEm] = useState<string | null>(null);

  useEffect(() => {
    if (!ativa) return;
    const id = setInterval(() => {
      router.refresh();
      setAtualizadoEm(new Date().toLocaleTimeString("pt-BR"));
    }, 5000);
    return () => clearInterval(id);
  }, [ativa, router]);

  if (!ativa) return null;
  return (
    <p className="text-xs text-muted">
      Atualizando sozinho{atualizadoEm ? ` · ${atualizadoEm}` : ""}
    </p>
  );
}

/** Tempo desde o início da transmissão, contado no navegador. */
export function Cronometro({ desde }: { desde: string }) {
  const [texto, setTexto] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      const segundos = Math.max(
        0,
        Math.floor((Date.now() - new Date(desde).getTime()) / 1000),
      );
      const h = String(Math.floor(segundos / 3600)).padStart(2, "0");
      const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, "0");
      const s = String(segundos % 60).padStart(2, "0");
      setTexto(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [desde]);

  return <span className="tabular-nums">{texto}</span>;
}
