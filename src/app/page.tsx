import Link from "next/link";
import { redirect } from "next/navigation";
import { carregarSessao } from "@/lib/session";
import { MODULES } from "@/lib/modules";
import { PortalShell } from "@/components/shell";
import { Selo, Vazio } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portal" };

export default async function Home() {
  const sessao = await carregarSessao();
  if (!sessao) redirect("/login");

  const { org, modulos, ehAgencia, email } = sessao;

  return (
    <PortalShell
      titulo={org?.name ?? "Portal do cliente"}
      email={email}
      ehAgencia={ehAgencia}
    >
      {!org ? (
        <Vazio
          titulo="Sua conta ainda não está vinculada a nenhuma empresa"
          descricao="Fale com a agência para liberar seu acesso."
        />
      ) : (
        // Os quatro módulos aparecem sempre: o cliente tem todos. O que varia é
        // o módulo já estar pronto para uso ou ainda em preparo — e um card que
        // não está pronto não leva a lugar nenhum, em vez de levar a uma tela
        // dizendo que ele não tem acesso.
        <section className="grid gap-4 sm:grid-cols-2">
          {modulos.map(({ chave, configurado }) => {
            const m = MODULES[chave];
            const aviso = !m.ready
              ? "Em breve"
              : !configurado
                ? "Em configuração"
                : null;

            const conteudo = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold">{m.label}</h2>
                  {aviso ? (
                    <span className="flex-none">
                      <Selo tom="atencao">{aviso}</Selo>
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      className="flex-none text-dim transition group-hover:translate-x-0.5 group-hover:text-foreground"
                    >
                      →
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted">{m.description}</p>
              </>
            );
            const classe =
              "group block rounded-lg border border-line bg-surface-1 p-5 transition hover:border-line-strong";

            // Card que não está pronto não leva a lugar nenhum — e por isso
            // também não é um link: `aria-disabled` num `<a>` continua sendo
            // tabulável e anunciado como link pelo leitor de tela.
            if (aviso) {
              return (
                <div key={chave} className={`${classe} opacity-70`}>
                  {conteudo}
                </div>
              );
            }
            return m.external ? (
              <a key={chave} href={m.href} className={classe}>
                {conteudo}
              </a>
            ) : (
              <Link key={chave} href={m.href} className={classe}>
                {conteudo}
              </Link>
            );
          })}
        </section>
      )}
    </PortalShell>
  );
}
