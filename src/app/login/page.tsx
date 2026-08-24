import Link from "next/link";
import { entrar } from "@/lib/auth-actions";
import { AuthShell } from "@/components/auth-shell";
import { BotaoEnviar, Campo, Entrada } from "@/components/ui";

export const metadata = { title: "Entrar" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  return (
    <AuthShell
      titulo="Entrar"
      subtitulo="Acesse o portal com seu email e senha."
      erro={searchParams.erro}
      rodape={
        <>
          <Link href="/esqueci-senha" className="hover:text-foreground">
            Esqueci minha senha
          </Link>
        </>
      }
    >
      <form action={entrar} className="space-y-4">
        <Campo rotulo="Email">
          <Entrada
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="email@empresa.com.br"
          />
        </Campo>
        <Campo rotulo="Senha">
          <Entrada
            name="senha"
            type="password"
            required
            autoComplete="current-password"
          />
        </Campo>
        <BotaoEnviar pendente="Entrando…" className="w-full">
          Entrar
        </BotaoEnviar>
      </form>
    </AuthShell>
  );
}
