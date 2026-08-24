/**
 * Etiqueta de estado.
 *
 * **Vermelho de marca nunca vira selo.** Como a paleta de selo é só
 * verde / âmbar / cinza / rosa, um selo avermelhado só pode significar erro —
 * não sobra ambiguidade com o vermelho da Momentum, que fica reservado para a
 * ação principal, o símbolo, a aba ativa e o anel de foco.
 *
 * Todo selo carrega ponto **e** palavra: cor sozinha não informa (daltonismo,
 * impressão, tela ruim).
 */
export type TomSelo = "pronto" | "atencao" | "neutro" | "erro";

const TOM: Record<TomSelo, string> = {
  pronto: "bg-ok/15 text-ok",
  atencao: "bg-warn/15 text-warn",
  neutro: "bg-surface-3 text-dim",
  erro: "bg-danger/15 text-danger",
};

export function Selo({
  tom = "neutro",
  ponto = true,
  children,
}: {
  tom?: TomSelo;
  ponto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TOM[tom]}`}
    >
      {ponto ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}
