export type TemaBio = {
  /** Cor de fundo da página pública. */
  fundo?: string;
  /** Cor do texto. */
  texto?: string;
  /** Cor de preenchimento dos botões. */
  botao?: string;
  /** Cor do texto dos botões. */
  botaoTexto?: string;
};

export const TEMA_PADRAO: Required<TemaBio> = {
  fundo: "#0b0d12",
  texto: "#f5f6f8",
  botao: "#ff5a1f",
  botaoTexto: "#ffffff",
};

export type LinkPage = {
  id: string;
  org_id: string;
  slug: string;
  title: string;
  bio: string | null;
  avatar_url: string | null;
  theme: TemaBio;
  pixel_id: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type LinkButton = {
  id: string;
  page_id: string;
  label: string;
  url: string;
  icon: string | null;
  position: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

/** O que a página pública mostra — sem ids de org nem nada de configuração. */
export type BotaoPublico = {
  id: string;
  label: string;
  icon: string | null;
};

export type PaginaPublica = {
  slug: string;
  title: string;
  bio: string | null;
  avatarUrl: string | null;
  tema: Required<TemaBio>;
  pixelId: string | null;
  botoes: BotaoPublico[];
};

export function temaCompleto(theme: TemaBio | null | undefined): Required<TemaBio> {
  return { ...TEMA_PADRAO, ...(theme ?? {}) };
}

/**
 * Um botão só aparece se estiver ativo e dentro da janela de agendamento.
 * Usado na página pública e de novo na hora do clique — o link pode ter sido
 * copiado e clicado depois do fim da promoção.
 */
export function botaoNoAr(
  b: Pick<LinkButton, "active" | "starts_at" | "ends_at">,
  agora = new Date(),
): boolean {
  if (!b.active) return false;
  if (b.starts_at && new Date(b.starts_at) > agora) return false;
  if (b.ends_at && new Date(b.ends_at) < agora) return false;
  return true;
}
