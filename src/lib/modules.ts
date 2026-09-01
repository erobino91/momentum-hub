export type ModuleKey = "dashboard" | "bio" | "fila" | "cmv";

export const MODULE_KEYS: ModuleKey[] = ["dashboard", "bio", "fila", "cmv"];

type ModuleInfo = {
  label: string;
  description: string;
  href: string;
  external: boolean;
  /** Falso enquanto o módulo ainda não existe (chega na fase indicada). */
  ready: boolean;
  fase: number;
  /**
   * Não há nada para a agência configurar: o módulo está pronto assim que
   * existe. Quem responde "este cliente já está configurado?" continua sendo
   * `modulos_configurados()` para todos os outros — este é o caso em que a
   * pergunta não faz sentido, e por isso mora aqui e não no banco.
   */
  semConfiguracao?: boolean;
};

export const MODULES: Record<ModuleKey, ModuleInfo> = {
  dashboard: {
    label: "Dashboard",
    description: "Resultados de vendas, pedidos e ticket médio.",
    href: "/dashboard",
    external: false,
    ready: true,
    fase: 2,
  },
  bio: {
    label: "Bio",
    description: "Sua página de links, com rastreamento de cliques.",
    href: "/bio",
    external: false,
    ready: true,
    fase: 3,
  },
  fila: {
    label: "Fila de Espera",
    description: "Lista de espera do salão, em tempo real.",
    href: "https://fila.mmtdigital.com.br",
    external: true,
    ready: true,
    fase: 4,
  },
  cmv: {
    label: "CMV",
    description: "Custo de mercadoria vendida e ficha técnica.",
    href: "https://cmv.mmtdigital.com.br",
    external: true,
    ready: true,
    fase: 5,
    // Quem preenche o CMV é o cliente — insumo, receita e produto são dele.
    // Acender o card só depois de existir dado trancaria justamente quem tem de
    // criar o primeiro insumo do lado de fora.
    semConfiguracao: true,
  },
};

/**
 * O cliente já pode usar este módulo? `configurados` é a resposta do banco para
 * os módulos que a agência prepara; módulo sem configuração ignora essa
 * pergunta.
 */
export function moduloPronto(
  chave: ModuleKey,
  configurados: Partial<Record<ModuleKey, boolean>>,
) {
  if (MODULES[chave].semConfiguracao) return true;
  return configurados[chave] ?? false;
}
