import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter é a fonte da marca — a mesma da `lp-agencia`. Servida pelo próprio
 * domínio (`next/font` baixa no build), então não há requisição ao Google em
 * tempo de execução nem salto de layout ao carregar.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--fonte-inter",
});

export const metadata: Metadata = {
  title: {
    default: "Momentum Hub",
    // Cada rota preenche o próprio nome; antes toda aba dizia "Momentum Hub".
    template: "%s · Momentum Hub",
  },
  description: "Portal do cliente — Momentum Digital",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
