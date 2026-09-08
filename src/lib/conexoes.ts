/**
 * As conexões da agência com as plataformas dos clientes.
 *
 * Cada conexão é uma coluna de `orgs` que guarda **o identificador** da loja
 * naquela plataforma — a conta de anúncio do Meta, a loja no CardápioWeb. A
 * credencial nunca vem para cá: ela fica no `.env` do cliente, do lado da
 * integração, e o coletor acha a pasta pelo id que está aqui.
 *
 * Esta lista é o seletor de plataforma. Preencher o campo do CardápioWeb é o
 * que diz "este cliente usa CardápioWeb" — não existe um segundo campo
 * "cardápio digital" para discordar dele.
 *
 * É o par de `relatorio-portal/fontes/index.mjs`, do outro lado: lá a fonte que
 * coleta, aqui o campo que vincula. Conexão nova entra nos dois.
 */

export type OrigemCampo = "meta" | "cw" | "goomer" | "ga4" | "google";

export type Conexao = {
  origem: OrigemCampo;
  /** Nome da plataforma, como aparece no cartão. */
  rotulo: string;
  /** Coluna de `orgs` que guarda o identificador. */
  coluna: string;
  /** Rótulo do campo. */
  campo: string;
  ajuda: string;
  placeholder: string;
  /**
   * Normaliza o que a pessoa colou. Devolve `valor: null` para campo vazio —
   * que é como se desvincula — ou `erro` quando não dá para aproveitar.
   */
  limpar: (bruto: string) => { valor: string | null; erro?: string };
};

export const CONEXOES: Conexao[] = [
  {
    origem: "meta",
    rotulo: "Meta Ads",
    coluna: "meta_ad_account_id",
    campo: "Conta de anúncio do Meta",
    ajuda: "Só números. Pode colar com o act_ na frente; ele sai sozinho.",
    placeholder: "act_2716559871841971",
    // O Gerenciador mostra `act_123…` na URL e `123…` na lista de contas;
    // exigir uma das duas formas transforma um copiar-colar em erro de
    // digitação. Guarda sempre sem o prefixo.
    limpar(bruto) {
      const conta = bruto.trim().replace(/^act_/i, "");
      if (!conta) return { valor: null };
      if (!/^\d{5,}$/.test(conta)) {
        return {
          valor: null,
          erro: "A conta de anúncio é só números (com ou sem act_).",
        };
      }
      return { valor: conta };
    },
  },
  {
    origem: "cw",
    rotulo: "CardápioWeb",
    coluna: "cw_store_id",
    campo: "Loja no CardápioWeb",
    ajuda: "O uuid da loja. Preenchido, salão e delivery param de ser digitados.",
    placeholder: "007f78f9-7132-46ca-ac61-8448c4801365",
    limpar(bruto) {
      const uuid = bruto.trim().toLowerCase();
      if (!uuid) return { valor: null };
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(uuid)
      ) {
        return {
          valor: null,
          erro: "A loja do CardápioWeb é o uuid, não o número nem o slug.",
        };
      }
      return { valor: uuid };
    },
  },
  {
    origem: "goomer",
    rotulo: "Goomer",
    coluna: "goomer_store_id",
    campo: "Loja na Goomer",
    ajuda: "O ID da loja, com o G- na frente. Preenchido, o delivery para de ser digitado.",
    placeholder: "G-57981",
    // A Goomer escreve `G-57981` no painel e no `.env`; aceitar o número solto
    // evita que colar de um lugar ou de outro vire erro de digitação, e guarda
    // sempre a forma com prefixo — duas grafias do mesmo id não achariam a
    // pasta do cliente.
    limpar(bruto) {
      const cru = bruto.trim().toUpperCase().replace(/^G-/, "");
      if (!cru) return { valor: null };
      if (!/^\d{3,}$/.test(cru)) {
        return {
          valor: null,
          erro: "A loja da Goomer é o G- seguido de números.",
        };
      }
      return { valor: `G-${cru}` };
    },
  },
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
