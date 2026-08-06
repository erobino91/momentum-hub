import Link from "next/link";
import { cadastrar } from "@/lib/auth-actions";
import { AuthShell, campoClasse, botaoClasse } from "@/components/auth-shell";

export default function CadastroPage({
  searchParams,
}: {
  searchParams: { erro?: string; ok?: string };
}) {
  return (
    <AuthShell
      titulo="Criar conta"
      subtitulo="Use o mesmo email que a agência cadastrou para você."
      erro={searchParams.erro}
      aviso={
        searchParams.ok
          ? "Conta criada. Confirme pelo link que enviamos no seu email."
          : undefined
      }
      rodape={
        <Link href="/login" className="hover:text-foreground">
          Já tenho conta
        </Link>
      }
    >
      <form action={cadastrar} className="space-y-3">
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
          minLength={8}
          autoComplete="new-password"
          placeholder="Senha (mínimo 8 caracteres)"
          className={campoClasse}
        />
        <button type="submit" className={botaoClasse}>
          Criar conta
        </button>
      </form>
    </AuthShell>
  );
}
