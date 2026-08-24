import type { ButtonHTMLAttributes } from "react";

/**
 * O botão do hub.
 *
 * Até a Fase 8 existia **uma** aparência de botão — laranja, preenchido,
 * `w-full` — e todo uso a reescrevia com `sm:w-auto sm:px-5`. Com um estilo só,
 * "Criar", "Publicar mês" e "Preparar fila" gritavam no mesmo volume na mesma
 * tela, e nada era secundário.
 *
 * A marca é vermelha, e vermelho também é a cor de perigo. Por isso a variante
 * `perigo` (vermelho preenchido) **só é usada dentro do diálogo de
 * confirmação**, depois que a intenção já foi declarada; em lista, quem apaga é
 * a variante `destrutivo`, neutra até o cursor chegar nela. Assim o único
 * vermelho cheio de uma tela é sempre a ação principal.
 */
export type VarianteBotao =
  | "primario"
  | "secundario"
  | "fantasma"
  | "destrutivo"
  | "perigo";

export type TamanhoBotao = "md" | "sm";

/**
 * Cada variante declara a **própria** cor de borda.
 *
 * Um `border-transparent` na base não serviria: entre duas utilitárias de
 * `border-color` quem ganha é a que vier depois na folha de estilo, não a que
 * vier depois no `className` — e o Tailwind emite `.border-transparent` depois
 * de `.border-line-strong`. O contorno do botão destrutivo sumia por isso.
 */
const VARIANTE: Record<VarianteBotao, string> = {
  primario: "border-transparent bg-brand text-white hover:bg-brand-hover",
  secundario:
    "border-line-strong bg-surface-2 text-foreground hover:bg-surface-3",
  fantasma:
    "border-transparent text-muted hover:bg-surface-2 hover:text-foreground",
  destrutivo:
    "border-line-strong text-muted hover:border-danger/45 hover:bg-danger/10 hover:text-danger",
  perigo: "border-transparent bg-danger text-canvas hover:brightness-95",
};

const TAMANHO: Record<TamanhoBotao, string> = {
  // 44px no celular (alvo de toque), 36px no desktop.
  md: "min-h-11 px-3.5 py-2 text-sm sm:min-h-9",
  sm: "min-h-9 px-2.5 py-1 text-xs sm:min-h-[30px]",
};

export function botaoEstilo(
  variante: VarianteBotao = "primario",
  tamanho: TamanhoBotao = "md",
) {
  return [
    "inline-flex items-center justify-center gap-2 rounded-md border",
    "font-semibold leading-tight whitespace-nowrap transition",
    "disabled:cursor-not-allowed disabled:opacity-40",
    VARIANTE[variante],
    TAMANHO[tamanho],
  ].join(" ");
}

export function Botao({
  variante = "primario",
  tamanho = "md",
  className = "",
  type = "button",
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
}) {
  return (
    <button
      type={type}
      className={`${botaoEstilo(variante, tamanho)} ${className}`}
      {...resto}
    />
  );
}

/** Rodinha de "estou trabalhando". Some para quem pediu menos animação. */
export function Rodinha({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70 ${className}`}
    />
  );
}
