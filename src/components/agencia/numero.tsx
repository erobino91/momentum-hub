/**
 * O número em destaque do painel — rótulo pequeno em caixa alta, valor grande
 * em dígito de largura fixa, e uma linha de alerta quando o número precisa de
 * contexto ("fechamento atrasado", "ninguém entra ainda").
 *
 * Nasceu dentro da tela da empresa e virou peça própria quando o financeiro
 * pediu a mesma fileira de números: duas cópias do mesmo bloco acabariam
 * divergindo no primeiro ajuste de espaçamento.
 */
export function Numero({
  rotulo,
  valor,
  alerta,
  tom = "neutro",
}: {
  rotulo: string;
  valor: string;
  alerta?: string;
  /** `alerta` pinta o valor de âmbar; `bom`, de verde. */
  tom?: "neutro" | "bom" | "alerta";
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-1 px-4 py-3">
      <p className="text-[10.5px] font-bold uppercase tracking-wider text-dim">
        {rotulo}
      </p>
      <p
        className={`mt-1 text-xl font-bold tabular tracking-tight ${
          tom === "bom" ? "text-ok" : tom === "alerta" ? "text-warn" : ""
        }`}
      >
        {valor}
      </p>
      {alerta ? (
        <p className="mt-1 text-[11.5px] font-semibold text-warn">{alerta}</p>
      ) : null}
    </div>
  );
}
