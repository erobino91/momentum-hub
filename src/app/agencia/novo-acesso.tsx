"use client";

import { useFormState, useFormStatus } from "react-dom";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import { criarAcessoCliente, type ResultadoAcesso } from "./actions";

const INICIAL: ResultadoAcesso = { estado: "vazio" };

/**
 * Dar acesso a um cliente.
 *
 * A senha sorteada aparece **uma vez**, aqui, e não é guardada em lugar nenhum.
 * Por isso este formulário não redireciona: numa querystring a senha entraria no
 * histórico do navegador e no log de acesso do servidor.
 */
export function NovoAcesso({ orgId }: { orgId: string }) {
  const [resultado, acao] = useFormState(criarAcessoCliente, INICIAL);

  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <p className="text-xs uppercase tracking-wider text-muted">
        Dar acesso ao portal
      </p>

      <form action={acao} className="mt-3 flex flex-wrap gap-3">
        <input type="hidden" name="org_id" value={orgId} />
        <input
          name="email"
          type="email"
          required
          placeholder="email do cliente"
          className={`${campoClasse} sm:w-64`}
        />
        <select name="role" className={`${campoClasse} sm:w-32`}>
          <option value="owner">owner</option>
          <option value="staff">staff</option>
          <option value="agency">agency</option>
        </select>
        <Botao />
      </form>

      {resultado.estado === "erro" ? (
        <p className="mt-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {resultado.mensagem}
        </p>
      ) : null}

      {resultado.estado === "vinculado" ? (
        <p className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {resultado.email} já tinha conta no portal e agora enxerga esta
          empresa. A senha continua a mesma.
        </p>
      ) : null}

      {resultado.estado === "criado" ? (
        <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-3 text-sm">
          <p className="text-emerald-300">
            Conta criada. Anote agora — a senha não aparece de novo.
          </p>
          <dl className="mt-2 space-y-1 font-mono text-xs">
            <div className="flex gap-2">
              <dt className="text-muted">email</dt>
              <dd>{resultado.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted">senha</dt>
              <dd className="select-all">{resultado.senha}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            O cliente entra em portal.mmtdigital.com.br e pode trocar a senha em
            “esqueci minha senha”.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Botao() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`${botaoClasse} sm:w-auto sm:px-5 disabled:opacity-50`}
    >
      {pending ? "Criando…" : "Criar acesso"}
    </button>
  );
}
