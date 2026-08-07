import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/modules";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import { criarPagina } from "@/app/bio/actions";
import {
  criarOrg,
  convidarUsuario,
  prepararFila,
  salvarSlugDashboard,
} from "./actions";
import type {
  Invite,
  ModuleConfig,
  ModulosConfigurados,
  Org,
} from "@/types/db";

export const dynamic = "force-dynamic";

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

  const { data: ents } = await supabase
    .from("module_config")
    .select("*")
    .returns<ModuleConfig[]>();

  const { data: convites } = await supabase
    .from("invites")
    .select("*")
    .is("accepted_at", null)
    .returns<Invite[]>();

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

  const slugDashboard = (orgId: string) => {
    const ent = ents?.find(
      (e) => e.org_id === orgId && e.module === "dashboard",
    );
    const valor = ent?.config?.dashboard_slug;
    return typeof valor === "string" ? valor : "";
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Área da agência
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Empresas</h1>
        </div>
        <Link href="/" className="text-sm text-muted hover:text-foreground">
          Voltar ao portal
        </Link>
      </header>

      {searchParams.erro ? (
        <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {searchParams.erro}
        </p>
      ) : null}

      <section className="mt-10 rounded-lg border border-white/15 bg-white/5 p-5">
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
          const pendentes = (convites ?? []).filter((c) => c.org_id === org.id);
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

              <div className="mt-5 border-t border-white/10 pt-5">
                <p className="text-xs uppercase tracking-wider text-muted">
                  Dashboard — slug no sistema antigo
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form
                    action={salvarSlugDashboard}
                    className="flex flex-wrap gap-3"
                  >
                    <input type="hidden" name="org_id" value={org.id} />
                    <input
                      name="dashboard_slug"
                      defaultValue={slugDashboard(org.id)}
                      placeholder="ex.: villa-burguer"
                      className={`${campoClasse} sm:w-64`}
                    />
                    <button
                      type="submit"
                      className={`${botaoClasse} sm:w-auto sm:px-5`}
                    >
                      Salvar
                    </button>
                  </form>
                  {pronto(org.id).dashboard ? (
                    <Link
                      href={`/dashboard?org=${org.id}`}
                      className="text-sm text-muted hover:text-foreground"
                    >
                      Abrir dashboard →
                    </Link>
                  ) : null}
                </div>
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

              <form
                action={convidarUsuario}
                className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5"
              >
                <input type="hidden" name="org_id" value={org.id} />
                <input
                  name="email"
                  type="email"
                  required
                  placeholder="email do cliente"
                  className={`${campoClasse} sm:w-64`}
                />
                <select name="role" className={`${campoClasse} sm:w-32`}>
                  <option value="owner">owner</option>
                  <option value="staff">staff</option>
                  <option value="agency">agency</option>
                </select>
                <button type="submit" className={`${botaoClasse} sm:w-auto sm:px-5`}>
                  Convidar
                </button>
              </form>

              {pendentes.length > 0 ? (
                <p className="mt-3 text-xs text-muted">
                  Convites pendentes:{" "}
                  {pendentes.map((c) => `${c.email} (${c.role})`).join(", ")}
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
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
