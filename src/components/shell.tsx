import Link from "next/link";
import { sair } from "@/lib/auth-actions";
import { createClient } from "@/lib/supabase/server";
import { MODULES } from "@/lib/modules";
import { Icone, type NomeIcone } from "@/components/icone";

/**
 * A casca das telas.
 *
 * Até aqui não havia navegação: cada página era um `<main>` solto com um
 * cabeçalho próprio e links de texto cinza — "Empresas", "Lives →", "Voltar ao
 * portal" — em posições diferentes a cada rota. Para sair da precificação de um
 * cliente e chegar aos resultados de outro era preciso voltar à lista e rolar.
 *
 * São duas cascas porque são dois usos: a agência trabalha o dia inteiro em
 * várias empresas (menu lateral fixo, sempre visível), o cliente entra para ver
 * uma coisa e sair (barra no topo, sem menu).
 */

export type SecaoAgencia = "empresas" | "lives" | "bio";

export type Migalha = { rotulo: string; href?: string };

/* ───────────────────────────── peças ───────────────────────────── */

function Marca({ legenda }: { legenda: string }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-surface-2"
    >
      <span
        aria-hidden
        className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-brand text-sm font-extrabold tracking-tighter text-white"
      >
        M
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-sm font-bold tracking-tight">
          Momentum
        </span>
        <span className="block truncate text-[10.5px] font-medium text-dim">
          {legenda}
        </span>
      </span>
    </Link>
  );
}

function ItemNav({
  href,
  icone,
  rotulo,
  ativo,
  contador,
  externo,
  tomContador,
}: {
  href: string;
  icone: NomeIcone;
  rotulo: string;
  ativo?: boolean;
  contador?: number | null;
  externo?: boolean;
  tomContador?: "normal" | "vivo";
}) {
  const classe = [
    "flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
    ativo
      ? "bg-brand/15 font-semibold text-foreground shadow-[inset_2px_0_0_rgb(var(--brand))]"
      : "font-medium text-muted hover:bg-surface-2 hover:text-foreground",
  ].join(" ");

  const conteudo = (
    <>
      <Icone nome={icone} className="h-4 w-4 flex-none opacity-90" />
      <span className="truncate">{rotulo}</span>
      {externo ? (
        <Icone nome="externo" className="ml-auto h-3.5 w-3.5 opacity-60" />
      ) : null}
      {contador ? (
        <span
          className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular ${
            tomContador === "vivo"
              ? "bg-danger/15 text-danger"
              : "bg-surface-2 text-dim"
          }`}
        >
          {contador}
        </span>
      ) : null}
    </>
  );

  return externo ? (
    <a href={href} className={classe} target="_blank" rel="noreferrer">
      {conteudo}
    </a>
  ) : (
    <Link href={href} className={classe} aria-current={ativo ? "page" : undefined}>
      {conteudo}
    </Link>
  );
}

function NavAgencia({
  secao,
  empresas,
  livesNoAr,
}: {
  secao: SecaoAgencia;
  empresas: number | null;
  livesNoAr: number | null;
}) {
  return (
    <nav className="flex flex-col gap-0.5">
      <ItemNav
        href="/agencia"
        icone="empresas"
        rotulo="Empresas"
        ativo={secao === "empresas"}
        contador={empresas}
      />
      <ItemNav
        href="/agencia/lives"
        icone="lives"
        rotulo="Lives"
        ativo={secao === "lives"}
        contador={livesNoAr}
        tomContador="vivo"
      />
      <ItemNav
        href="/bio"
        icone="bio"
        rotulo="Páginas de bio"
        ativo={secao === "bio"}
      />

      <p className="px-2.5 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-dim">
        Atalhos
      </p>
      <ItemNav href="/" icone="portal" rotulo="Portal do cliente" />
      <ItemNav href={MODULES.fila.href} icone="fila" rotulo="Fila de Espera" externo />
    </nav>
  );
}

function Usuario({ email }: { email: string | null }) {
  return (
    <div className="mt-auto border-t border-line px-2.5 pb-1 pt-3">
      <p className="truncate text-xs font-semibold text-muted" title={email ?? ""}>
        {email ?? "—"}
      </p>
      <form action={sair}>
        <button
          type="submit"
          className="mt-0.5 text-xs text-dim transition hover:text-danger"
        >
          Sair
        </button>
      </form>
    </div>
  );
}

/** Cabeçalho de conteúdo: onde estou, o que é esta tela, o que dá para fazer. */
function Topo({
  migalha,
  titulo,
  selo,
  acoes,
  menu,
}: {
  migalha?: Migalha[];
  titulo: string;
  selo?: React.ReactNode;
  acoes?: React.ReactNode;
  menu?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/90 px-5 py-3.5 backdrop-blur lg:px-7">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {menu}
        <div className="min-w-0">
          {migalha?.length ? (
            <nav aria-label="Trilha" className="flex items-center gap-1.5 text-xs text-dim">
              {migalha.map((m, i) => (
                <span key={`${m.rotulo}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 ? <span aria-hidden>/</span> : null}
                  {m.href ? (
                    <Link href={m.href} className="transition hover:text-foreground">
                      {m.rotulo}
                    </Link>
                  ) : (
                    <span className="font-semibold text-foreground">{m.rotulo}</span>
                  )}
                </span>
              ))}
            </nav>
          ) : null}
          <h1 className="mt-0.5 flex flex-wrap items-center gap-2.5 text-xl font-bold tracking-tight">
            <span className="truncate">{titulo}</span>
            {selo}
          </h1>
        </div>
        {acoes ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">{acoes}</div>
        ) : null}
      </div>
    </header>
  );
}

/* ─────────────────────────── área da agência ─────────────────────────── */

export async function AgenciaShell({
  secao,
  migalha,
  titulo,
  selo,
  acoes,
  children,
}: {
  secao: SecaoAgencia;
  migalha?: Migalha[];
  titulo: string;
  selo?: React.ReactNode;
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  const supabase = createClient();

  // Duas contagens `head` (só o total, sem trazer linha) para os contadores do
  // menu — quem já está no ar precisa aparecer de qualquer tela.
  const [{ data: user }, empresas, lives] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("orgs").select("id", { count: "exact", head: true }),
    supabase
      .from("live_sessions")
      .select("id", { count: "exact", head: true })
      .in("status", ["starting", "live", "ending"]),
  ]);

  const nav = (
    <NavAgencia
      secao={secao}
      empresas={empresas.count ?? null}
      livesNoAr={lives.count ?? null}
    />
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col gap-1 border-r border-line bg-surface-1 p-3 lg:flex">
        <div className="pb-3">
          <Marca legenda="Área da agência" />
        </div>
        {nav}
        <Usuario email={user.user?.email ?? null} />
      </aside>

      <div className="min-w-0">
        <Topo
          migalha={migalha}
          titulo={titulo}
          selo={selo}
          acoes={acoes}
          menu={
            // Gaveta do celular sem JavaScript: `<details>` já abre, fecha e é
            // operável pelo teclado.
            <details className="relative lg:hidden">
              <summary
                aria-label="Abrir menu"
                className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-md border border-line-strong bg-surface-2 text-muted transition marker:hidden hover:text-foreground [&::-webkit-details-marker]:hidden"
              >
                <Icone nome="menu" />
              </summary>
              <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-line-strong bg-surface-1 p-2 shadow-2xl">
                {nav}
                <Usuario email={user.user?.email ?? null} />
              </div>
            </details>
          }
        />
        <main className="px-5 py-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}

/* ───────────────────────────── portal ───────────────────────────── */

export function PortalShell({
  titulo,
  migalha,
  acoes,
  email,
  ehAgencia,
  children,
}: {
  titulo: string;
  migalha?: Migalha[];
  acoes?: React.ReactNode;
  email: string | null;
  ehAgencia: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div className="border-b border-line bg-surface-1">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Marca legenda="Portal do cliente" />
          <div className="ml-auto flex items-center gap-3 text-sm">
            {ehAgencia ? (
              <Link
                href="/agencia"
                className="font-medium text-muted transition hover:text-foreground"
              >
                Área da agência
              </Link>
            ) : null}
            <span className="hidden text-xs text-dim sm:inline">{email}</span>
            <form action={sair}>
              <button
                type="submit"
                className="text-sm text-muted transition hover:text-danger"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl">
        <Topo migalha={migalha} titulo={titulo} acoes={acoes} />
        <main className="px-5 py-6 lg:px-7">{children}</main>
      </div>
    </div>
  );
}
