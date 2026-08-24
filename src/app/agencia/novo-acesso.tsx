"use client";

import { useFormState } from "react-dom";
import { BotaoEnviar, Campo, Entrada, Selecao, Aviso } from "@/components/ui";
import { criarAcessoCliente, type ResultadoAcesso } from "./actions";

const INICIAL: ResultadoAcesso = { estado: "vazio" };

/**
 * Dar acesso a um cliente.
 *
 * Até a Fase 8 este formulário estava montado **dez vezes** na lista da
 * agência, um por empresa, sempre aberto. Agora é um só, na aba de acessos da
 * empresa.
 *
 * Ele continua sendo um formulário na página, e não um diálogo: a senha
 * sorteada aparece **uma vez** no resultado, e diálogo que fecha ao enviar
 * levaria a senha junto. Pelo mesmo motivo a action devolve resultado em vez de
 * redirecionar — em querystring a senha entraria no histórico do navegador e no
 * log de acesso do servidor.
 */
export function NovoAcesso({ orgId }: { orgId: string }) {
  const [resultado, acao] = useFormState(criarAcessoCliente, INICIAL);

  return (
    <div>
      <form action={acao} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="org_id" value={orgId} />
        <Campo rotulo="Email do cliente" className="min-w-[240px] flex-1">
          <Entrada
            name="email"
            type="email"
            required
            autoComplete="off"
            placeholder="dono@empresa.com.br"
          />
        </Campo>
        <Campo rotulo="Papel" className="w-36">
          <Selecao name="role" defaultValue="owner">
            <option value="owner">owner</option>
            <option value="staff">staff</option>
            <option value="agency">agency</option>
          </Selecao>
        </Campo>
        <BotaoEnviar pendente="Criando…">Criar acesso</BotaoEnviar>
      </form>

      {resultado.estado === "erro" ? (
        <div className="mt-4">
          <Aviso tom="erro">{resultado.mensagem}</Aviso>
        </div>
      ) : null}

      {resultado.estado === "vinculado" ? (
        <div className="mt-4">
          <Aviso tom="ok">
            {resultado.email} já tinha conta no portal e agora enxerga esta
            empresa. A senha continua a mesma.
          </Aviso>
        </div>
      ) : null}

      {resultado.estado === "criado" ? (
        <div className="mt-4 rounded-lg border border-ok/40 bg-ok/10 p-4">
          <p className="text-sm font-semibold text-ok">
            Conta criada. Anote agora — a senha não aparece de novo.
          </p>
          <dl className="mt-3 grid gap-1.5 font-mono text-xs">
            <div className="flex gap-3">
              <dt className="w-12 text-dim">email</dt>
              <dd className="select-all">{resultado.email}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-12 text-dim">senha</dt>
              <dd className="select-all text-sm font-bold tracking-wide">
                {resultado.senha}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">
            O cliente entra em portal.mmtdigital.com.br e pode trocar a senha em
            “esqueci minha senha”.
          </p>
        </div>
      ) : null}
    </div>
  );
}
