/**
 * A conta da precificação iFood, igual à do `pricing.html` do projeto antigo.
 *
 * Só `taxa_extra` é percentual. `campanha`, `entrega` e `cupom` entram em reais
 * — foi conferido com o Luis antes da migração da Fase 6, e é por isso que os
 * três aparecem com valores pequenos (R$ 5,00) no banco em vez de percentuais.
 *
 *   Fase 1 = balcão × (1 + taxa/100) + campanha
 *   Fase 2 = Fase 1 + entrega grátis
 *   Fase 3 = Fase 2 + cupom
 *
 * `pct` é quanto a Fase 3 ficou acima do balcão; a tela pinta verde a partir de
 * +38%, que é a meta de ~40% que a coluna sempre anunciou.
 */

export type VariaveisPreco = {
  taxa_extra: number;
  campanha: number;
  entrega: number;
  cupom: number;
};

export function precos(balcao: number, v: VariaveisPreco) {
  const f1 = balcao * (1 + v.taxa_extra / 100) + v.campanha;
  const f2 = f1 + v.entrega;
  const f3 = f2 + v.cupom;
  const pct = balcao > 0 ? ((f3 - balcao) / balcao) * 100 : 0;
  return { f1, f2, f3, pct };
}

export function formatarBRL(n: number): string {
  return `R$ ${Number(n || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
