import Link from "next/link";

export function AuthShell({
  titulo,
  subtitulo,
  erro,
  aviso,
  children,
  rodape,
}: {
  titulo: string;
  subtitulo?: string;
  erro?: string;
  aviso?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="text-xs uppercase tracking-[0.3em] text-muted hover:text-foreground"
        >
          Momentum Digital
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{titulo}</h1>
        {subtitulo ? <p className="mt-2 text-sm text-muted">{subtitulo}</p> : null}

        {erro ? (
          <p className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {erro}
          </p>
        ) : null}
        {aviso ? (
          <p className="mt-6 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {aviso}
          </p>
        ) : null}

        <div className="mt-6">{children}</div>
        {rodape ? <div className="mt-6 text-sm text-muted">{rodape}</div> : null}
      </div>
    </main>
  );
}

export const campoClasse =
  "w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";

export const botaoClasse =
  "w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-black transition hover:opacity-90";
