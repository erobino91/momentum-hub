import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/modules";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import { criarPagina } from "@/app/bio/actions";
import { criarOrg, prepararFila } from "./actions";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { NovoAcesso } from "./novo-acesso";
import { AgenciaShell } from "@/components/shell";
import { Aviso } from "@/components/ui";
import type { Membership, ModulosConfigurados, Org } from "@/types/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empresas" };

export default async function AgenciaPage({
  searchParams,
}: {
  searchParams: { erro?: string; ok?: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const { data: orgs } = await supabase
    .from("orgs")
    .select("*")
    .order("name")
    .returns<Org[]>();

  // Quem já entra no portal, por empresa. O email mora em `auth.users`, que a
  // sessão da agência não lê — daí a chave secreta, server-side.
  const { data: vinculos } = await supabase
    .from("memberships")
    .select("user_id,org_id,role")
    .returns<Pick<Membership, "user_id" | "org_id" | "role">[]>();

  const { data: usuarios } = await clienteSecreto().auth.admin.listUsers({
    perPage: 1000,
  });
  const emailDe = new Map(
    (usuarios?.users ?? []).map((u) => [u.id, u.email ?? u.id]),
  );

  const acessos = (orgId: string) =>
    (vinculos ?? [])
      .filter((v) => v.org_id === orgId)
      .map((v) => `${emailDe.get(v.user_id) ?? "—"} (${v.role})`);

  // Estado real de cada empresa, do mesmo lugar que o portal do cliente lê —
  // assim a área da agência não pode discordar do que o cliente está vendo.
  const prontos = new Map<string, ModulosConfigurados>();
  for (const org of orgs ?? []) {
    const { data } = await supabase.rpc("modulos_configurados", {
      p_org: org.id,
    });
    prontos.set(
      org.id,
      (data as ModulosConfigurados) ?? {
        dashboard: false,
        bio: false,
        fila: false,
      },
    );
  }

  const pronto = (orgId: string) =>
    prontos.get(orgId) ?? { dashboard: false, bio: false, fila: false };

  return (
    <AgenciaShell
      secao="empresas"
      migalha={[{ rotulo: "Empresas" }]}
      titulo={`${(orgs ?? []).length} empresas`}
    >
      {searchParams.erro ? (
        <div className="mb-6">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      <section className="rounded-lg border border-white/15 bg-white/5 p-5">
        <h2 className="text-lg font-medium">Nova empresa</h2>
        <form action={criarOrg} className="mt-4 flex flex-wrap gap-3">
          <input
            name="name"
            required
            placeholder="Nome"
            className={`${campoClasse} sm:w-56`}
          />
          <input
            name="slug"
            required
            placeholder="slug-da-empresa"
            className={`${campoClasse} sm:w-56`}
          />
          <button type="submit" className={`${botaoClasse} sm:w-auto sm:px-5`}>
            Criar
          </button>
        </form>
      </section>

      <div className="mt-8 space-y-6">
        {(orgs ?? []).map((org) => {
          return (
            <section
              key={org.id}
              className="rounded-lg border border-white/15 bg-white/5 p-5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-lg font-medium">{org.name}</h2>
                <span className="text-xs text-muted">{org.slug}</span>
              </div>

              {/* Não há o que ligar: o cliente tem os quatro módulos. O que a
                  agência faz aqui é preparar cada um — e enquanto não preparar,
                  o cliente vê o card apagado, escrito "em configuração". */}
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <Selo pronto={pronto(org.id).dashboard} nome={MODULES.dashboard.label} />
                <Selo pronto={pronto(org.id).bio} nome={MODULES.bio.label} />
                <Selo pronto={pronto(org.id).fila} nome={MODULES.fila.label} />
                <span className="rounded-full border border-white/15 px-3 py-1 text-muted">
                  {MODULES.cmv.label} · em breve
                </span>
              </div>

              {/* Desde a Fase 6 os números moram aqui: o dashboard do cliente
                  é alimentado nesta tela, não mais no projeto antigo. */}
              <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-5 text-sm">
                <Link
                  href={`/agencia/${org.id}/periodos`}
                  className={`${botaoClasse} sm:w-auto sm:px-5`}
                >
                  Resultados por mês
                </Link>
                <Link
                  href={`/agencia/${org.id}/precificacao`}
                  className="text-muted hover:text-foreground"
                >
                  Precificação iFood →
                </Link>
                {pronto(org.id).dashboard ? (
                  <Link
                    href={`/dashboard?org=${org.id}`}
                    className="text-muted hover:text-foreground"
                  >
                    Ver o dashboard →
                  </Link>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                {pronto(org.id).bio ? (
                  <Link
                    href="/bio"
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Página de bio criada — editar →
                  </Link>
                ) : (
                  // Nasce com o endereço e o nome da própria empresa; a agência
                  // ajusta no editor, para onde esta ação já leva.
                  <form action={criarPagina}>
                    <input type="hidden" name="org_id" value={org.id} />
                    <input type="hidden" name="slug" value={org.slug} />
                    <input type="hidden" name="title" value={org.name} />
                    <button
                      type="submit"
                      className={`${botaoClasse} sm:w-auto sm:px-5`}
                    >
                      Criar página de bio
                    </button>
                  </form>
                )}

                {pronto(org.id).fila ? (
                  <a
                    href={MODULES.fila.href}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    Fila preparada — abrir →
                  </a>
                ) : (
                  <form action={prepararFila}>
                    <input type="hidden" name="org_id" value={org.id} />
                    <button
                      type="submit"
                      className={`${botaoClasse} sm:w-auto sm:px-5`}
                    >
                      Preparar fila
                    </button>
                  </form>
                )}
              </div>

              <NovoAcesso orgId={org.id} />

              {acessos(org.id).length > 0 ? (
                <p className="mt-3 text-xs text-muted">
                  Com acesso: {acessos(org.id).join(", ")}
                </p>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  Ninguém desta empresa entra no portal ainda.
                </p>
              )}
            </section>
          );
        })}
      </div>
    </AgenciaShell>
  );
}

/** Estado de um módulo para uma empresa. Informativo — não é um botão. */
function Selo({ pronto, nome }: { pronto: boolean; nome: string }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 ${
        pronto
          ? "border-accent bg-accent/15 text-foreground"
          : "border-white/15 text-muted"
      }`}
    >
      {nome} · {pronto ? "pronto" : "em configuração"}
    </span>
  );
}
