/**
 * Ler e escrever número como brasileiro escreve.
 *
 * O fechamento do mês tem 24 campos numéricos e era `type="number"` puro: para
 * lançar cento e quarenta e sete mil e quatrocentos e cinquenta e seis reais era
 * preciso digitar `147456.00`, com ponto. Errar a vírgula ali não dá erro
 * nenhum — publica um número que o cliente lê como certo.
 *
 * O projeto antigo tinha o extremo oposto: um campo estilo caixa eletrônico,
 * enchendo da direita para a esquerda, que se atrapalhava quando alguém colava
 * valor em formato americano. Aqui o campo aceita as duas escritas e normaliza
 * quando o cursor sai.
 */

/**
 * `18.430,00`, `18430,00`, `18,430.00` e `18430` viram `18430`.
 *
 * O caso ambíguo é um ponto sozinho: `1.234` é mil duzentos e trinta e quatro
 * para quem escreve em português e um vírgula dois para quem escreve em inglês.
 * A regra é a que corresponde ao que se digita num campo de dinheiro em reais:
 * ponto seguido de exatamente três dígitos é separador de milhar; qualquer
 * outra quantidade é decimal (`12.50` são doze reais e cinquenta).
 */
export function paraNumero(texto: string): number | null {
  const limpo = texto.replace(/[R$\s ]/g, "");
  if (!limpo) return null;

  const temVirgula = limpo.includes(",");
  const temPonto = limpo.includes(".");

  let normalizado: string;
  if (temVirgula && temPonto) {
    // O último separador que aparece é o decimal; o outro é de milhar.
    const decimal = limpo.lastIndexOf(",") > limpo.lastIndexOf(".") ? "," : ".";
    const milhar = decimal === "," ? "." : ",";
    normalizado = limpo.split(milhar).join("").replace(decimal, ".");
  } else if (temVirgula) {
    normalizado = limpo.split(",").join(".");
  } else if (temPonto) {
    normalizado = /\.\d{3}(?:\D|$)/.test(limpo)
      ? limpo.split(".").join("")
      : limpo;
  } else {
    normalizado = limpo;
  }

  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

/** `18430` → `18.430,00`. Sem o "R$" — o prefixo é desenhado no campo. */
export function formatarDinheiro(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** `2140` → `2.140`. */
export function formatarInteiro(valor: number): string {
  return Math.round(valor).toLocaleString("pt-BR");
}

/** O que aparece no campo: formatado se der para ler, cru se não der. */
export function formatarCampo(texto: string, tipo: "dinheiro" | "inteiro") {
  const n = paraNumero(texto);
  if (n === null) return texto;
  return tipo === "dinheiro" ? formatarDinheiro(n) : formatarInteiro(n);
}
