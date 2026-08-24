/**
 * Ícones da navegação.
 *
 * SVG traçado, não emoji: emoji muda de desenho a cada sistema, não herda a cor
 * do texto e é lido em voz alta pelo leitor de tela. Todos aqui saem da mesma
 * grade de 24px com traço de 1,75 — misturar espessuras é o que faz um painel
 * parecer remendado.
 */
const CAMINHOS = {
  empresas: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  lives:
    "M4.9 19.1a10 10 0 0 1 0-14.2M7.8 16.2a6 6 0 0 1 0-8.5M16.2 7.8a6 6 0 0 1 0 8.5M19.1 4.9a10 10 0 0 1 0 14.2",
  bio: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  portal: "M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
  fila: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  externo: "M7 17 17 7M8 7h9v9",
  menu: "M3 6h18M3 12h18M3 18h18",
  voltar: "M15 18l-6-6 6-6",
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

export function Icone({
  nome,
  className = "h-4 w-4",
}: {
  nome: NomeIcone;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={CAMINHOS[nome]} />
      {nome === "lives" ? <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" /> : null}
    </svg>
  );
}
