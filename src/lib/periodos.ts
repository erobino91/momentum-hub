/**
 * Os campos de um mês de dashboard, em um lugar só.
 *
 * A tela da agência e a action que grava leem desta lista — no projeto antigo o
 * `periods.html` tinha o mapa `FIELDS` de um lado e o `INSERT` do outro, e era
 * possível adicionar campo na tela que nunca chegava ao banco.
 */

export type TipoCampo = "dinheiro" | "inteiro";

export type CampoPeriodo = {
  coluna: string;
  rotulo: string;
  tipo: TipoCampo;
};

export type GrupoPeriodo = {
  titulo: string;
  ajuda?: string;
  campos: CampoPeriodo[];
};

const dinheiro = (coluna: string, rotulo: string): CampoPeriodo => ({
  coluna,
  rotulo,
  tipo: "dinheiro",
});

const inteiro = (coluna: string, rotulo: string): CampoPeriodo => ({
  coluna,
  rotulo,
  tipo: "inteiro",
});

export const GRUPOS_PERIODO: GrupoPeriodo[] = [
  {
    titulo: "Faturamento",
    campos: [
      // Os três primeiros são as partes que somam o total, nesta ordem: é a
      // conta que o dashboard do cliente faz, e a tela mostra na mesma
      // sequência. `fat_total` continua na lista porque a action grava a coluna
      // a partir dela — mas quem preenche é o campo calculado do formulário,
      // não a agência.
      dinheiro("fat_mesa", "Salão"),
      dinheiro("fat_delivery", "Delivery"),
      dinheiro("fat_ifood", "iFood"),
      dinheiro("fat_total", "Total"),
      dinheiro("fat_proprio", "Cardápio próprio"),
    ],
  },
  {
    titulo: "Pedidos",
    ajuda: "O ticket médio do dashboard é faturamento ÷ pedidos.",
    campos: [
      inteiro("pedidos_mesa", "Salão"),
      inteiro("pedidos_delivery", "Delivery"),
    ],
  },
  {
    titulo: "Funil do cardápio próprio",
    campos: [
      inteiro("cp_visitas", "Visitas"),
      inteiro("cp_views", "Views"),
      inteiro("cp_sacola", "Sacola"),
      inteiro("cp_revisao", "Revisão"),
      inteiro("cp_concluidos", "Concluídos"),
    ],
  },
  {
    titulo: "Funil do iFood",
    campos: [
      inteiro("if_visitas", "Visitas"),
      inteiro("if_views", "Views"),
      inteiro("if_sacola", "Sacola"),
      inteiro("if_revisao", "Revisão"),
      inteiro("if_concluidos", "Concluídos"),
    ],
  },
  {
    titulo: "Meta Ads",
    campos: [
      dinheiro("meta_invest", "Investimento"),
      dinheiro("meta_vendas", "Vendas"),
    ],
  },
  {
    titulo: "Google",
    campos: [
      dinheiro("google_invest", "Investimento"),
      dinheiro("google_vendas", "Vendas"),
      inteiro("google_visitas_loja", "Visitas à loja"),
      inteiro("google_rotas", "Rotas"),
    ],
  },
  {
    titulo: "CRM",
    campos: [
      dinheiro("crm_invest", "Investimento"),
      dinheiro("crm_vendas", "Vendas"),
    ],
  },
];

export const CAMPOS_PERIODO: CampoPeriodo[] = GRUPOS_PERIODO.flatMap(
  (g) => g.campos,
);

/** Rótulo de mês: `2026-08-01` → `agosto/2026`. */
export function nomeDoMes(data: string): string {
  const [ano, mes] = data.split("-");
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`;
}

/**
 * `2026-08` (do input `type="month"`) ou `2026-08-01` → `2026-08-01`.
 * O dashboard compara meses pela data, então todo período é dia 1.
 */
export function primeiroDiaDoMes(valor: string): string | null {
  const m = valor.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) return null;
  return `${m[1]}-${m[2]}-01`;
}
