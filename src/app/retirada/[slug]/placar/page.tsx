import { notFound } from "next/navigation";
import { Anton } from "next/font/google";
import { contarVendas, evento } from "@/lib/retirada";
import { Placar } from "./placar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Placar",
  robots: { index: false, follow: false },
};

const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap" });

/**
 * Placar da venda: quantos lanches saíram, pedidos e meta. Público e sem PIN —
 * só mostra totais, nenhum dado de cliente. Feito para TV e para print de story.
 */
export default async function PlacarPage({ params }: { params: { slug: string } }) {
  if (!evento(params.slug)) notFound();
  let dados = null;
  try {
    dados = await contarVendas(params.slug);
  } catch (e) {
    console.error("placar", params.slug, e);
  }
  return <Placar dados={dados} fonte={anton.className} />;
}
