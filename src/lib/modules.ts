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
    ready: false,
    fase: 5,
  },
};
