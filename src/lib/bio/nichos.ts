import { TEMA_PADRAO, type NichoBio, type TemaBio } from "@/types/bio";

/**
 * A variação por nicho da página de bio, num lugar só.
 *
 * O layout é **um** — a "Vitrine" de `bio-render.tsx`. O que muda de um nicho
 * para o outro é token: paleta, textura de fundo, forma dos cartões e as
 * sugestões de botão. Nicho novo é uma entrada aqui, não uma varredura pelo
 * `src/`.
 */

export type FormaBio = "generosa" | "firme" | "delicada" | "reta";

export type SugestaoBotao = { icon: string; label: string };

export type DefinicaoNicho = {
  nome: string;
  descricao: string;
  paleta: Required<TemaBio>;
  /** Classe da textura de fundo (definida em `globals.css`). Vazio = sem textura. */
  textura: string;
  forma: FormaBio;
  sugestoes: SugestaoBotao[];
};

const ZAP: SugestaoBotao = { icon: "💬", label: "Chamar no WhatsApp" };
const CHEGAR: SugestaoBotao = { icon: "📍", label: "Como chegar" };
const INSTA: SugestaoBotao = { icon: "📸", label: "Instagram" };

export const NICHOS: Record<NichoBio, DefinicaoNicho> = {
  classico: {
    nome: "Clássico",
    descricao:
      "O visual neutro do portal: fundo escuro, botões iguais. Serve a qualquer negócio.",
    paleta: TEMA_PADRAO,
    textura: "",
    forma: "firme",
    sugestoes: [],
  },

  burguer: {
    nome: "Burguer · lanche",
    descricao: "Paleta quente, cartões gordos e textura de grão. Apetite à primeira vista.",
    paleta: {
      fundo: "#F2620C",
      fundo2: "#8C2F04",
      texto: "#FFF6EA",
      botao: "#FFF6EA",
      botaoTexto: "#2A1206",
      nicho: "burguer",
      destaque: "#FFC24A",
    },
    textura: "bio-textura-grao",
    forma: "generosa",
    sugestoes: [{ icon: "🍔", label: "Peça agora" }, ZAP, CHEGAR, INSTA],
  },

  pizza: {
    nome: "Pizza · esfiha",
    descricao: "Tijolo e vinho com xadrez de cantina apagado. Cartão firme, ar de forno.",
    paleta: {
      fundo: "#B33A2B",
      fundo2: "#5E1810",
      texto: "#FBEBD7",
      botao: "#FFF3E2",
      botaoTexto: "#2B1108",
      nicho: "pizza",
      destaque: "#E8B04B",
    },
    textura: "bio-textura-xadrez",
    forma: "firme",
    sugestoes: [{ icon: "🍕", label: "Peça agora" }, ZAP, CHEGAR, INSTA],
  },

  doceria: {
    nome: "Doceria · bolo · açaí",
    descricao: "Pastel com confete, cartão fino e arejado. Leve, para doce e sorvete.",
    paleta: {
      fundo: "#F7C7DB",
      fundo2: "#CE9BD6",
      texto: "#3B2030",
      botao: "#FFFDFB",
      botaoTexto: "#3B2030",
      nicho: "doceria",
      destaque: "#C0567A",
    },
    textura: "bio-textura-confete",
    forma: "delicada",
    sugestoes: [
      { icon: "🍰", label: "Peça agora" },
      ZAP,
      { icon: "📝", label: "Encomendas" },
      INSTA,
    ],
  },

  sushi: {
    nome: "Sushi · japonês",
    descricao: "Azul-noite com onda seigaiha e cartão de canto reto. Sóbrio, para rodízio e delivery japonês.",
    paleta: {
      fundo: "#1F2A38",
      fundo2: "#0B0F16",
      texto: "#F2EDE4",
      botao: "#F6F1E7",
      botaoTexto: "#1A2029",
      nicho: "sushi",
      // Vermelhão japonês fechado o bastante para o branco do CTA passar em
      // 4,8:1; o salmão claro parava em 3,7 e o rótulo ficava mole.
      destaque: "#C9432B",
    },
    textura: "bio-textura-ondas",
    forma: "reta",
    sugestoes: [{ icon: "🍣", label: "Peça agora" }, ZAP, CHEGAR, INSTA],
  },
};

export const NICHOS_LISTA = Object.keys(NICHOS) as NichoBio[];

export function ehNicho(v: string): v is NichoBio {
  return (NICHOS_LISTA as string[]).includes(v);
}

export function nichoDe(v: string | null | undefined): NichoBio {
  return v && ehNicho(v) ? v : "classico";
}

export function paletaDoNicho(n: NichoBio): Required<TemaBio> {
  return { ...NICHOS[n].paleta };
}

/**
 * Preto ou branco por cima de uma cor, pelo que der mais contraste.
 *
 * O CTA é pintado com a cor de **destaque**, que o cliente escolhe: fixar a
 * tinta em clara ou escura entregaria botão ilegível na primeira paleta que
 * fugisse do esperado.
 */
export function tintaSobre(cor: string): string {
  const hex = cor.replace("#", "").trim();
  const cheio =
    hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex.padEnd(6, "0").slice(0, 6);

  const canal = (i: number) => {
    const v = parseInt(cheio.slice(i, i + 2), 16) / 255;
    return Number.isNaN(v) ? 0 : v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };

  const lum = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4);
  // Contraste contra branco vs. contra preto, na fórmula da WCAG.
  return (1.05 / (lum + 0.05)) >= ((lum + 0.05) / 0.05) ? "#FFFFFF" : "#151013";
}
