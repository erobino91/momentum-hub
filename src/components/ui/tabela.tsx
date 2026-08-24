/**
 * Tabela.
 *
 * O painel da agência é ferramenta interna: densidade de tabela serve melhor
 * que cartão. Dez empresas em dez cartões viram quatro mil pixels de rolagem;
 * em linhas, cabem na primeira tela.
 *
 * `Tabela` sempre rola dentro de si mesma — a página nunca rola de lado.
 */
export function Tabela({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className={`w-full border-collapse text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
}

export const thEstilo =
  "border-b border-line px-3 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-dim";

export const tdEstilo = "border-b border-line px-3 py-3 align-middle";

/** Coluna de número: alinhada à direita e com dígitos de largura fixa. */
export const numEstilo = "text-right tabular";
