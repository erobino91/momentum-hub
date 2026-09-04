/**
 * Barra de progresso determinada.
 *
 * Existe porque subir material de live era uma caixa-preta: o operador clicava,
 * via "Enviando…" e não sabia se o arquivo estava andando, parado ou morto.
 *
 * **A cor diz o que é.** `marca` para o envio — é a ação principal que a pessoa
 * acabou de disparar, e é justamente o caso que a regra do vermelho reserva.
 * `atencao` para a conversão, no mesmo âmbar do selo "convertendo" que fica ao
 * lado: ali a barra é estado ambiente, não ação, e vermelho de estado é o que a
 * paleta de selo evita de propósito.
 *
 * Sem `valor` a barra fica indeterminada — é o "ainda não sei", que mente menos
 * do que fingir 0%.
 */
export type TomProgresso = "marca" | "atencao";

const TOM: Record<TomProgresso, string> = {
  marca: "bg-brand",
  atencao: "bg-warn",
};

export function Progresso({
  valor,
  tom = "marca",
  rotulo,
  detalhe,
}: {
  /** 0 a 100. `null`/`undefined` deixa a barra indeterminada. */
  valor?: number | null;
  tom?: TomProgresso;
  /** Texto à esquerda, acima da barra. */
  rotulo?: React.ReactNode;
  /** Texto abaixo — o "18,7 MB de 30,3 MB". */
  detalhe?: React.ReactNode;
}) {
  const indeterminada = valor == null || Number.isNaN(valor);
  const pct = indeterminada ? 0 : Math.max(0, Math.min(100, Math.round(valor)));

  return (
    <div>
      {rotulo || !indeterminada ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 truncate text-muted">{rotulo}</span>
          {indeterminada ? null : (
            <span className="shrink-0 font-semibold tabular-nums text-foreground">
              {pct} %
            </span>
          )}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        // Sem `aria-valuenow` o leitor de tela anuncia "ocupado" em vez de um
        // número errado — é o que se quer enquanto o valor é desconhecido.
        aria-valuenow={indeterminada ? undefined : pct}
        aria-label={typeof rotulo === "string" ? rotulo : undefined}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-200 ease-out ${TOM[tom]} ${
            indeterminada ? "w-1/3 animate-pulse" : ""
          }`}
          style={indeterminada ? undefined : { width: `${pct}%` }}
        />
      </div>

      {detalhe ? (
        // `aria-live` educado: a pessoa ouve o andamento sem ser interrompida a
        // cada atualização.
        <p className="mt-1.5 text-xs tabular-nums text-dim" aria-live="polite">
          {detalhe}
        </p>
      ) : null}
    </div>
  );
}

/** `31809446` vira `30,3 MB`. Sempre MB: o arquivo aqui nunca é pequeno. */
export function formatarMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} MB`;
}
