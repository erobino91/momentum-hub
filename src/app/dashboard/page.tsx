import Link from "next/link";
import { redirect } from "next/navigation";
import { carregarDashboard, type FalhaDashboard } from "@/lib/dashboard";
import { DashboardView } from "./dashboard-view";

export const dynamic = "force-dynamic";

const AVISO: Record<FalhaDashboard, string> = {
  "sem-org":
    "Sua conta ainda não está vinculada a nenhuma empresa. Fale com a agência.",
  "sem-modulo": "O módulo Dashboard não está liberado para a sua empresa.",
  "sem-slug":
    "O dashboard ainda não foi configurado pela agência. Fale com a gente que ligamos em minutos.",
  "sem-dados": "Ainda não há resultados publicados para a sua empresa.",
  "sem-config": "Configuração do dashboard ausente no servidor.",
  erro: "Não foi possível carregar os resultados agora. Tente de novo em instantes.",
  "sem-sessao": "",
};

export default async function DashboardPage({
  searchParams,
}: {
  /** `org` só funciona para papel `agency` — ver `carregarDashboard`. */
  searchParams: { org?: string };
}) {
  const resultado = await carregarDashboard(searchParams.org);

  if (!resultado.ok) {
    if (resultado.motivo === "sem-sessao") redirect("/login");
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-4 rounded-md border border-white/15 bg-white/5 px-4 py-6 text-sm text-muted">
          {AVISO[resultado.motivo]}
        </p>
        <Link
          href="/"
          className="mt-6 text-sm text-muted transition hover:text-foreground"
        >
          Voltar ao portal
        </Link>
      </main>
    );
  }

  return (
    <DashboardView
      dados={resultado.dados}
      prefixoTitulo={searchParams.org ? "Visão da agência" : undefined}
    />
  );
}
