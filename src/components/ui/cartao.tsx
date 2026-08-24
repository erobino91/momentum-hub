/**
 * Caixa de conteúdo — a peça que estava escrita à mão em toda página, cada vez
 * com uma combinação diferente de `bg-white/5`, `bg-white/[0.03]`,
 * `border-white/10` e `border-white/15`.
 */
export function Cartao({
  titulo,
  descricao,
  acao,
  className = "",
  children,
}: {
  titulo?: string;
  descricao?: string;
  /** Canto superior direito: um botão, um selo, um link. */
  acao?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface-1 p-5 ${className}`}
    >
      {titulo || acao ? (
        // Sem `flex-wrap`: com ele, uma descrição um pouco mais longa empurrava
        // o selo para a linha de baixo, e cartões lado a lado ficavam com a
        // etiqueta em alturas diferentes. O bloco de texto encolhe (`min-w-0`)
        // e quebra por dentro; o selo fica no canto, sempre.
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {titulo ? (
              <h2 className="text-base font-semibold">{titulo}</h2>
            ) : null}
            {descricao ? (
              <p className="mt-1 text-sm text-muted">{descricao}</p>
            ) : null}
          </div>
          {acao ? <div className="flex-none">{acao}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/**
 * Nada para mostrar. Um estado vazio explica **por que** está vazio e oferece a
 * saída — antes eram frases soltas em cinza, sem ação nenhuma.
 */
export function Vazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line-strong bg-surface-1 px-6 py-10 text-center">
      <p className="text-sm font-semibold">{titulo}</p>
      {descricao ? (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
          {descricao}
        </p>
      ) : null}
      {acao ? <div className="mt-4 flex justify-center">{acao}</div> : null}
    </div>
  );
}
