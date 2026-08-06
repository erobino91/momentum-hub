import { definirSenha } from "@/lib/auth-actions";
import { AuthShell, campoClasse, botaoClasse } from "@/components/auth-shell";

export default function NovaSenhaPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  return (
    <AuthShell
      titulo="Nova senha"
      subtitulo="Defina a senha que você vai usar daqui pra frente."
      erro={searchParams.erro}
    >
      <form action={definirSenha} className="space-y-3">
        <input
          name="senha"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Nova senha (mínimo 8 caracteres)"
          className={campoClasse}
        />
        <button type="submit" className={botaoClasse}>
          Salvar senha
        </button>
      </form>
    </AuthShell>
  );
}
