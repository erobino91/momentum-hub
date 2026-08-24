import { redirect } from "next/navigation";
import { carregarDashboard, type FalhaDashboard } from "@/lib/dashboard";
import { carregarSessao } from "@/lib/session";
import { DashboardView } from "./dashboard-view";
import { PortalShell } from "@/components/shell";
import { Selo, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const AVISO: Record<FalhaDashboard, { titulo: string; descricao: string }> = {
  "sem-org": {
    titulo: "Sua conta ainda não está vinculada a nenhuma empresa",
    descricao: "Fale com a agência para liberar seu acesso.",
  },
  "sem-dados": {
    titulo: "Ainda não há resultados publicados",
    descricao:
      "Assim que a agência fechar o primeiro mês, ele aparece aqui.",
  },
  erro: {
    titulo: "Não foi possível carregar os resultados agora",
    descricao: "Tente de novo em instantes.",
  },
  "sem-sessao": { titulo: "", descricao: "" },
};

export default async function DashboardPage({
  searchParams,
}: {
  /** `org` só funciona para papel `agency` — ver `carregarDashboard`. */
  searchParams: { org?: string };
}) {
  const [resultado, sessao] = await Promise.all([
    carregarDashboard(searchParams.org),
    carregarSessao(),
  ]);

  if (!resultado.ok) {
    if (resultado.motivo === "sem-sessao") redirect("/login");
    const aviso = AVISO[resultado.motivo];
    return (
      <PortalShell
        titulo="Dashboard"
        migalha={[{ rotulo: "Portal", href: "/" }, { rotulo: "Dashboard" }]}
        email={sessao?.email ?? null}
        ehAgencia={sessao?.ehAgencia ?? false}
      >
        <Vazio titulo={aviso.titulo} descricao={aviso.descricao} />
      </PortalShell>
    );
  }

  // A agência abrindo o dashboard de um cliente vê de quem é a tela — sem isso,
  // duas abas abertas em clientes diferentes são indistinguíveis.
  const daAgencia = Boolean(searchParams.org);

  return (
    <PortalShell
      titulo={resultado.dados.cliente.nome}
      migalha={[{ rotulo: "Portal", href: "/" }, { rotulo: "Dashboard" }]}
      acoes={daAgencia ? <Selo tom="neutro">visão da agência</Selo> : undefined}
      email={sessao?.email ?? null}
      ehAgencia={sessao?.ehAgencia ?? false}
    >
      <DashboardView dados={resultado.dados} />
    </PortalShell>
  );
}
