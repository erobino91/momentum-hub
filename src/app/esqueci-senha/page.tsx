import Link from "next/link";
import { pedirRecuperacao } from "@/lib/auth-actions";
import { AuthShell, campoClasse, botaoClasse } from "@/components/auth-shell";

export const metadata = { title: "Esqueci minha senha" };

export default function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: { erro?: string; ok?: string };
}) {
  return (
    <AuthShell
      titulo="Recuperar senha"
      subtitulo="Enviamos um link para você criar uma senha nova."
      erro={searchParams.erro}
      aviso={
        searchParams.ok
          ? "Se existir conta com esse email, o link já está a caminho."
          : undefined
      }
      rodape={
        <Link href="/login" className="hover:text-foreground">
          Voltar para o login
        </Link>
      }
    >
      <form action={pedirRecuperacao} className="space-y-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="email@empresa.com.br"
          className={campoClasse}
        />
        <button type="submit" className={botaoClasse}>
          Enviar link
        </button>
      </form>
    </AuthShell>
  );
}
