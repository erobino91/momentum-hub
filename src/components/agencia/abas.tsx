import Link from "next/link";

/**
 * Abas de uma empresa.
 *
 * Antes, "resultados" e "precificação" eram rotas soltas alcançadas por links
 * cinza na lista geral — e não havia tela nenhuma da empresa. Aqui cada aba é
 * um endereço de verdade: o botão voltar do navegador funciona, e dá para
 * mandar o link de uma aba específica para alguém.
 */
export type AbaEmpresa =
  | "geral"
  | "resultados"
  | "precificacao"
  | "acessos";

const ABAS: { chave: AbaEmpresa; rotulo: string; caminho: string }[] = [
  { chave: "geral", rotulo: "Visão geral", caminho: "" },
  { chave: "resultados", rotulo: "Resultados", caminho: "/periodos" },
  { chave: "precificacao", rotulo: "Precificação", caminho: "/precificacao" },
  { chave: "acessos", rotulo: "Acessos", caminho: "/acessos" },
];

export function AbasEmpresa({
  orgId,
  ativa,
}: {
  orgId: string;
  ativa: AbaEmpresa;
}) {
  return (
    <nav className="-mx-5 mb-6 flex gap-1 overflow-x-auto border-b border-line px-5 lg:-mx-7 lg:px-7">
      {ABAS.map((aba) => {
        const atual = aba.chave === ativa;
        return (
          <Link
            key={aba.chave}
            href={`/agencia/${orgId}${aba.caminho}`}
            aria-current={atual ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition ${
              atual
                ? "border-brand text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
