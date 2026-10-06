"use client";

import { useState } from "react";
import { Botao } from "@/components/ui";

/** Copia o link para colar no WhatsApp do cliente. */
export function CopiarLink({ url }: { url: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <Botao
      variante="primario"
      tamanho="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
    >
      {copiado ? "Copiado" : "Copiar link"}
    </Botao>
  );
}
