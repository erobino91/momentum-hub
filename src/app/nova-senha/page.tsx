import { definirSenha } from "@/lib/auth-actions";
import { AuthShell } from "@/components/auth-shell";
import { BotaoEnviar, Campo, Entrada } from "@/components/ui";

export const metadata = { title: "Nova senha" };

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
      <form action={definirSenha} className="space-y-4">
        <Campo rotulo="Nova senha" ajuda="Mínimo de 8 caracteres.">
          <Entrada
            name="senha"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Campo>
        <BotaoEnviar pendente="Salvando…" className="w-full">
          Salvar senha
        </BotaoEnviar>
      </form>
    </AuthShell>
  );
}
