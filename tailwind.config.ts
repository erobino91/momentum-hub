import type { Config } from "tailwindcss";

/** Todo token vem de `globals.css` em canais RGB — ver o comentário de lá. */
const cor = (nome: string) => `rgb(var(--${nome}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: cor("canvas"),
        surface: {
          1: cor("surface-1"),
          2: cor("surface-2"),
          3: cor("surface-3"),
        },
        line: {
          DEFAULT: cor("line"),
          strong: cor("line-strong"),
        },
        foreground: cor("foreground"),
        muted: cor("muted"),
        dim: cor("dim"),
        brand: {
          DEFAULT: cor("brand"),
          hover: cor("brand-hover"),
          ink: cor("brand-ink"),
        },
        ok: cor("ok"),
        warn: cor("warn"),
        danger: cor("danger"),

        // Telas anteriores à Fase 8 ainda usam estes dois nomes.
        accent: cor("brand"),
        background: cor("canvas"),
      },
      borderRadius: {
        // 3 degraus em vez dos 5 que estavam espalhados pelo projeto.
        md: "6px",
        lg: "10px",
        xl: "14px",
      },
      fontFamily: {
        sans: ["var(--fonte-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
