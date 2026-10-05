/**
 * As conexões da agência com as plataformas dos clientes.
 *
 * Cada conexão é uma coluna de `orgs` que guarda **o identificador** da loja
 * naquela plataforma — a conta de anúncio do Meta, a loja no CardápioWeb. A
 * credencial nunca vem para cá: ela fica no `.env` do cliente, do lado da
 * integração, e o coletor acha a pasta pelo id que está aqui.
 *
 * Quem grava o vínculo é o back-end da integração (`gravarVinculo`, em
 * `relatorio-portal/portal.mjs`), nunca uma tela: o painel só mostra. A coluna
 * preenchida é o que diz "este cliente usa CardápioWeb" — não existe um segundo
 * campo "cardápio digital" para discordar dela.
 *
 * É o par de `relatorio-portal/fontes/index.mjs`, do outro lado: lá a fonte que
 * coleta, aqui a coluna que vincula. Conexão nova entra nos dois.
 */

export type OrigemCampo = "meta" | "cw" | "goomer" | "ga4" | "ifood" | "google";

export type Conexao = {
  origem: OrigemCampo;
  /** Nome da plataforma, como aparece no cartão. */
  rotulo: string;
  /** Coluna de `orgs` que guarda o identificador. */
  coluna: string;
};

export const CONEXOES: Conexao[] = [
  { origem: "meta", rotulo: "Meta Ads", coluna: "meta_ad_account_id" },
  { origem: "cw", rotulo: "CardápioWeb", coluna: "cw_store_id" },
  { origem: "goomer", rotulo: "Goomer", coluna: "goomer_store_id" },
  { origem: "ga4", rotulo: "Google Analytics", coluna: "ga4_property_id" },
  { origem: "ifood", rotulo: "iFood", coluna: "ifood_merchant_id" },
  // Entra no cartão, mas não trava nada: os campos do bloco Google não têm
  // `origens` em `periodos.ts` e seguem digitáveis no fechamento.
  { origem: "google", rotulo: "Google Ads", coluna: "google_ads_customer_id" },
];

/** As colunas de vínculo, para quem só precisa ler `orgs`. */
export const COLUNAS_VINCULO = CONEXOES.map((c) => c.coluna);

/** As conexões que uma empresa tem preenchidas. */
export function conexoesDe(org: Record<string, unknown> | null): OrigemCampo[] {
  if (!org) return [];
  return CONEXOES.filter((c) => org[c.coluna]).map((c) => c.origem);
}

export const rotuloDaOrigem = (origem: OrigemCampo): string =>
  CONEXOES.find((c) => c.origem === origem)?.rotulo ?? origem;
