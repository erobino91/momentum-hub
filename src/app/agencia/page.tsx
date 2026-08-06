import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MODULES, MODULE_KEYS, type ModuleKey } from "@/lib/modules";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import {
  criarOrg,
  alternarModulo,
  convidarUsuario,
  salvarSlugDashboard,
} from "./actions";
import type { Entitlement, Invite, Org } from "@/types/db";

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
    .from("entitlements")
    .select("*")
    .returns<Entitlement[]>();

  const { data: convites } = await supabase
    .from("invites")
    .select("*")
    .is("accepted_at", null)
    .returns<Invite[]>();

  const ligado = (orgId: string, module: ModuleKey) =>
    ents?.some((e) => e.org_id === orgId && e.module === module && e.enabled) ??
    false;

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

              <div className="mt-4 flex flex-wrap gap-2">
                {MODULE_KEYS.map((key) => {
                  const on = ligado(org.id, key);
                  return (
                    <form key={key} action={alternarModulo}>
                      <input type="hidden" name="org_id" value={org.id} />
                      <input type="hidden" name="module" value={key} />
                      <input type="hidden" name="ligar" value={on ? "0" : "1"} />
                      <button
                        type="submit"
                        className={`rounded-full border px-3 py-1 text-sm transition ${
                          on
                            ? "border-accent bg-accent/15 text-foreground"
                            : "border-white/15 text-muted hover:text-foreground"
                        }`}
                      >
                        {MODULES[key].label}
                        <span className="ml-2 text-xs">{on ? "on" : "off"}</span>
                      </button>
                    </form>
                  );
                })}
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
                  {ligado(org.id, "dashboard") && slugDashboard(org.id) ? (
                    <Link
                      href={`/dashboard?org=${org.id}`}
                      className="text-sm text-muted hover:text-foreground"
                    >
                      Abrir dashboard →
                    </Link>
                  ) : null}
                </div>
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
