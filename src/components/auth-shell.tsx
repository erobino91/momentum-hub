import Link from "next/link";
import { Aviso } from "@/components/ui";
import { campoEstilo } from "@/components/ui/campo";
import { botaoEstilo } from "@/components/ui/botao";

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
          className="text-xs font-semibold uppercase tracking-[0.3em] text-dim transition hover:text-foreground"
        >
          Momentum Digital
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{titulo}</h1>
        {subtitulo ? <p className="mt-2 text-sm text-muted">{subtitulo}</p> : null}

        {erro ? (
          <div className="mt-6">
            <Aviso tom="erro">{erro}</Aviso>
          </div>
        ) : null}
        {aviso ? (
          <div className="mt-6">
            <Aviso tom="ok">{aviso}</Aviso>
          </div>
        ) : null}

        <div className="mt-6">{children}</div>
        {rodape ? <div className="mt-6 text-sm text-muted">{rodape}</div> : null}
      </div>
    </main>
  );
}

/**
 * Compatibilidade com as telas anteriores à Fase 8.
 *
 * Eram estas duas strings o sistema de design inteiro do projeto. Continuam
 * exportadas — agora apontando para os tokens novos, para que toda página
 * ganhe o vermelho da marca e o contraste corrigido antes mesmo de ser
 * reescrita. Em código novo, usar `Campo`/`Entrada` e `Botao` de
 * `@/components/ui`.
 */
export const campoClasse = campoEstilo;

export const botaoClasse = `${botaoEstilo("primario")} w-full`;
