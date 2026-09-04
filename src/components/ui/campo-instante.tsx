"use client";

import { useState } from "react";
import { campoEstilo } from "./campo";

/**
 * Data e hora que chegam ao servidor **com fuso**.
 *
 * `<input type="datetime-local">` entrega `"2026-09-04T19:00"` — sem fuso
 * nenhum. Mandar essa string crua para uma server action e fazer `new Date(t)`
 * lá é o erro clássico: sem offset, o `Date` completa com o fuso de **quem
 * executa**, que na Vercel é UTC. O operador digita 19h em Brasília e o banco
 * guarda 19h UTC — três horas de diferença, sem erro nenhum aparecer.
 *
 * (Não é hipótese: `src/app/bio/actions.ts` faz exatamente isso hoje, e a
 * janela de agendamento dos botões da bio está deslocada em produção por causa
 * disso. Este componente existe para o agendamento de live não repetir o caso,
 * e serve de conserto para lá quando for a hora.)
 *
 * A conversão fica no navegador, que é o único lugar onde o fuso do operador é
 * conhecido: o campo visível guarda o texto local, e um `hidden` ao lado leva o
 * ISO com offset. Quem lê no servidor recebe um instante sem ambiguidade.
 */
export function CampoInstante({
  name,
  disabled,
}: {
  /** Nome do campo escondido — é ele que chega no `FormData`. */
  name: string;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState("");

  return (
    <>
      <input
        type="datetime-local"
        value={local}
        disabled={disabled}
        onChange={(e) => setLocal(e.target.value)}
        className={`${campoEstilo} cursor-pointer`}
      />
      <input type="hidden" name={name} value={paraISO(local)} />
    </>
  );
}

/**
 * Texto do `datetime-local` → ISO com offset. Vazio continua vazio: campo em
 * branco significa "sem horário", e um `Invalid Date` viraria exceção na hora
 * de formatar.
 */
function paraISO(local: string): string {
  if (!local) return "";
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

