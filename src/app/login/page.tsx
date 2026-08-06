import Link from "next/link";
import { entrar } from "@/lib/auth-actions";
import { AuthShell, campoClasse, botaoClasse } from "@/components/auth-shell";

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
          <span className="mx-2">·</span>
          <Link href="/cadastro" className="hover:text-foreground">
            Criar conta
          </Link>
        </>
      }
    >
      <form action={entrar} className="space-y-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="email@empresa.com.br"
          className={campoClasse}
        />
        <input
          name="senha"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Senha"
          className={campoClasse}
        />
        <button type="submit" className={botaoClasse}>
          Entrar
        </button>
      </form>
    </AuthShell>
  );
}
