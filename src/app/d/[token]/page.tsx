import { notFound } from "next/navigation";
import { carregarDashboardPorLink } from "@/lib/dashboard";
import { DashboardView } from "@/app/dashboard/dashboard-view";
import { Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";

// O token está na URL: fora do Google e sem ir no Referer de link nenhum.
export const metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Dashboard pelo link fixo, sem login. Só leitura e só meses publicados — o
 * resto do portal (CMV, fila, bio) continua atrás do login.
 */
export default async function DashboardPorLinkPage({
  params,
}: {
  params: { token: string };
}) {
  const resultado = await carregarDashboardPorLink(params.token);
  // Token errado ou trocado: 404, sem dizer se a empresa existe.
  if (!resultado.ok && resultado.motivo !== "sem-dados") notFound();

  return (
    <div className="min-h-screen">
      <div className="border-b border-line bg-surface-1">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-2.5 px-5 py-3">
          <span
            aria-hidden
            className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand text-sm font-extrabold tracking-tighter text-white"
          >
            M
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-sm font-bold tracking-tight">
              {resultado.ok ? resultado.dados.cliente.nome : "Momentum"}
            </span>
            <span className="block truncate text-[10.5px] font-medium text-dim">
              Resultados · Momentum Digital
            </span>
          </span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-5 py-6 lg:px-7">
        {resultado.ok ? (
          <DashboardView dados={resultado.dados} />
        ) : (
          <Vazio
            titulo="Ainda não há resultados publicados"
            descricao="Assim que a agência fechar o primeiro mês, ele aparece aqui."
          />
        )}
      </main>
    </div>
  );
}
