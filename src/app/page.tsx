import Link from "next/link";
import { redirect } from "next/navigation";
import { carregarSessao } from "@/lib/session";
import { MODULES } from "@/lib/modules";
import { sair } from "@/lib/auth-actions";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");

  const { org, modulos, ehAgencia, email } = sessao;

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted">
            Momentum Digital
          </p>
          <h1 className="mt-2 text-3xl font-semibold">
            {org?.name ?? "Portal do cliente"}
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted">
          {ehAgencia ? (
            <Link href="/agencia" className="hover:text-foreground">
              Área da agência
            </Link>
          ) : null}
          <span className="hidden sm:inline">{email}</span>
          <form action={sair}>
            <button type="submit" className="hover:text-foreground">
              Sair
            </button>
          </form>
        </div>
      </header>

      {!org ? (
        <p className="mt-12 rounded-md border border-white/15 bg-white/5 px-4 py-6 text-sm text-muted">
          Sua conta ainda não está vinculada a nenhuma empresa. Fale com a
          agência para liberar seu acesso.
        </p>
      ) : modulos.length === 0 ? (
        <p className="mt-12 rounded-md border border-white/15 bg-white/5 px-4 py-6 text-sm text-muted">
          Nenhum módulo liberado ainda. Assim que a agência ativar, ele aparece
          aqui.
        </p>
      ) : (
        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          {modulos.map((key) => {
            const m = MODULES[key];
            const conteudo = (
              <>
                <h2 className="text-lg font-medium">{m.label}</h2>
                <p className="mt-1 text-sm text-muted">{m.description}</p>
                {!m.ready ? (
                  <p className="mt-3 text-xs uppercase tracking-wider text-accent">
                    Em breve
                  </p>
                ) : null}
              </>
            );
            const classe =
              "block rounded-lg border border-white/15 bg-white/5 p-5 transition hover:border-accent";

            if (!m.ready) {
              return (
                <div key={key} className={`${classe} opacity-60`}>
                  {conteudo}
                </div>
              );
            }
            return m.external ? (
              <a key={key} href={m.href} className={classe}>
                {conteudo}
              </a>
            ) : (
              <Link key={key} href={m.href} className={classe}>
                {conteudo}
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
