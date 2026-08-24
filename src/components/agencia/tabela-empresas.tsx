import Link from "next/link";
import { MODULES, MODULE_KEYS, type ModuleKey } from "@/lib/modules";
import {
  Selo,
  Tabela,
  botaoEstilo,
  numEstilo,
  tdEstilo,
  thEstilo,
} from "@/components/ui";
import {
  iniciais,
  mesAtrasado,
  mesCurto,
  reaisCurtos,
  type EmpresaPainel,
} from "@/lib/agencia";

/**
 * As empresas em linhas.
 *
 * Dez empresas eram dez cartões idênticos empilhados — quatro mil pixels de
 * rolagem em que cada cartão só sabia de si. Em tabela, as perguntas que a
 * agência realmente faz ("quem está com o mês atrasado?", "quem ainda não tem
 * ninguém no portal?") têm resposta de um olhar, e a linha inteira cabe na
 * primeira tela.
 */
export function TabelaEmpresas({ empresas }: { empresas: EmpresaPainel[] }) {
  return (
    <>
      {/* Seis colunas não cabem em 390px, e tabela que rola de lado obriga a
          arrastar para descobrir o que existe. No celular vira lista. */}
      <div className="hidden lg:block">
        <Tabela>
          <thead>
            <tr>
              <th className={thEstilo}>Empresa</th>
              <th className={thEstilo}>Módulos</th>
              <th className={thEstilo}>Acessos</th>
              <th className={`${thEstilo} ${numEstilo}`}>Último mês</th>
              <th className={`${thEstilo} ${numEstilo}`}>Faturamento</th>
              <th className={thEstilo} />
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <LinhaEmpresa key={e.id} empresa={e} />
            ))}
          </tbody>
        </Tabela>
      </div>

      <ul className="space-y-2 lg:hidden">
        {empresas.map((e) => (
          <CartaoEmpresa key={e.id} empresa={e} />
        ))}
      </ul>
    </>
  );
}

function CartaoEmpresa({ empresa: e }: { empresa: EmpresaPainel }) {
  const atrasado = mesAtrasado(e.ultimo_mes);

  return (
    <li>
      <Link
        href={`/agencia/${e.id}`}
        className="block rounded-lg border border-line bg-surface-1 p-3.5 transition hover:border-line-strong"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{e.name}</p>
            <p className="truncate font-mono text-[11.5px] text-dim">{e.slug}</p>
          </div>
          {e.acessos > 0 ? (
            <Selo tom="pronto">{e.acessos}</Selo>
          ) : (
            <Selo tom="atencao">ninguém</Selo>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          {MODULE_KEYS.map((chave) => (
            <Modulo
              key={chave}
              chave={chave}
              pronto={chave === "cmv" ? false : e[chave]}
            />
          ))}
          <span className="ml-auto text-xs tabular">
            <span className={atrasado ? "font-semibold text-warn" : "text-dim"}>
              {mesCurto(e.ultimo_mes)}
            </span>
            <span className="ml-2 text-muted">
              {reaisCurtos(e.ultimo_faturamento)}
            </span>
          </span>
        </div>
      </Link>
    </li>
  );
}

function LinhaEmpresa({ empresa: e }: { empresa: EmpresaPainel }) {
  const atrasado = mesAtrasado(e.ultimo_mes);
  const semNada = !e.dashboard && !e.bio && !e.fila;

  return (
    <tr className="transition hover:bg-surface-1">
      <td className={tdEstilo}>
        <Link
          href={`/agencia/${e.id}`}
          className="flex items-center gap-3 rounded-md"
        >
          <span
            aria-hidden
            className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface-3 text-xs font-bold text-muted"
          >
            {iniciais(e.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{e.name}</span>
            <span className="block truncate font-mono text-[11.5px] text-dim">
              {e.slug}
            </span>
          </span>
        </Link>
      </td>

      <td className={tdEstilo}>
        <div className="flex gap-1.5">
          {MODULE_KEYS.map((chave) => (
            <Modulo
              key={chave}
              chave={chave}
              // O CMV ainda não existe para ninguém.
              pronto={chave === "cmv" ? false : e[chave]}
            />
          ))}
        </div>
      </td>

      <td className={tdEstilo}>
        {e.acessos > 0 ? (
          <Selo tom="pronto">{e.acessos}</Selo>
        ) : (
          <Selo tom="atencao">ninguém</Selo>
        )}
      </td>

      <td className={`${tdEstilo} ${numEstilo}`}>
        <span className={atrasado ? "font-semibold text-warn" : "text-muted"}>
          {mesCurto(e.ultimo_mes)}
        </span>
      </td>

      <td className={`${tdEstilo} ${numEstilo}`}>
        <span className={e.ultimo_faturamento === null ? "text-dim" : ""}>
          {reaisCurtos(e.ultimo_faturamento)}
        </span>
      </td>

      <td className={`${tdEstilo} ${numEstilo}`}>
        {/* Secundário mesmo na empresa por configurar: sete das dez estão nesse
            estado, e sete botões vermelhos numa tela não destacam nada. Quem
            avisa é o selo âmbar e o traço na coluna do mês. */}
        <Link
          href={semNada ? `/agencia/${e.id}` : `/agencia/${e.id}/periodos`}
          className={botaoEstilo("secundario", "sm")}
        >
          {semNada ? "Configurar" : "Resultados"}
        </Link>
      </td>
    </tr>
  );
}

/**
 * Quadradinho por módulo. A letra é o rótulo — cor sozinha não diz nada a quem
 * não distingue verde de cinza — e o `title` completa para o resto.
 */
function Modulo({ chave, pronto }: { chave: ModuleKey; pronto: boolean }) {
  const rotulo = `${MODULES[chave].label}: ${
    chave === "cmv" ? "em breve" : pronto ? "pronto" : "em configuração"
  }`;
  return (
    <span
      title={rotulo}
      aria-label={rotulo}
      className={`grid h-6 w-6 place-items-center rounded border text-[10.5px] font-bold ${
        pronto
          ? "border-ok/30 bg-ok/15 text-ok"
          : "border-line bg-surface-2 text-dim"
      }`}
    >
      {MODULES[chave].label[0]}
    </span>
  );
}
