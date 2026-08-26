import Link from "next/link";
import {
  BotaoEnviar,
  Campo,
  ConfirmarAcao,
  Dialogo,
  Entrada,
  Selo,
  Tabela,
  botaoEstilo,
  numEstilo,
  tdEstilo,
  thEstilo,
  type TomSelo,
} from "@/components/ui";
import { iniciais } from "@/lib/agencia";
import {
  dataCurta,
  diasDeAtraso,
  estadoCobranca,
  hojeISO,
  reais,
  rotuloEstado,
  type EstadoCobranca,
  type LinhaFinanceiro,
} from "@/lib/financeiro";
import {
  cancelarCobranca,
  desfazerPagamento,
  marcarPago,
} from "@/app/agencia/financeiro/actions";

/**
 * O mês em linhas.
 *
 * A pergunta que a tela responde é "quem devo cobrar hoje?", então a ordem não
 * é alfabética: atrasado primeiro, depois em aberto, e o que já está resolvido
 * afunda. Empresa sem contrato fica no fim — é pendência de cadastro, não de
 * cobrança, e não pode competir com dinheiro atrasado pela atenção de quem abre
 * a tela.
 */
const PESO: Record<EstadoCobranca, number> = {
  atrasado: 0,
  pendente: 1,
  "nao-gerada": 2,
  pago: 3,
  cancelado: 4,
  "sem-contrato": 5,
};

const TOM: Record<EstadoCobranca, TomSelo> = {
  atrasado: "erro",
  pendente: "atencao",
  "nao-gerada": "neutro",
  pago: "pronto",
  cancelado: "neutro",
  "sem-contrato": "atencao",
};

export function ordenarPorUrgencia(linhas: LinhaFinanceiro[], hoje = hojeISO()) {
  return [...linhas].sort((a, b) => {
    const pa = PESO[estadoCobranca(a, hoje)];
    const pb = PESO[estadoCobranca(b, hoje)];
    if (pa !== pb) return pa - pb;
    // Dentro do mesmo estado, o que vence antes vem antes.
    const va = a.vencimento ?? "9999-12-31";
    const vb = b.vencimento ?? "9999-12-31";
    return va === vb ? a.name.localeCompare(b.name, "pt-BR") : va < vb ? -1 : 1;
  });
}

export function TabelaFinanceiro({
  linhas,
  mes,
  hoje,
}: {
  linhas: LinhaFinanceiro[];
  mes: string;
  hoje: string;
}) {
  return (
    <>
      {/* Cinco colunas não cabem em 390px; no celular vira lista. */}
      <div className="hidden lg:block">
        <Tabela>
          <thead>
            <tr>
              <th className={thEstilo}>Empresa</th>
              <th className={`${thEstilo} ${numEstilo}`}>Vencimento</th>
              <th className={`${thEstilo} ${numEstilo}`}>Valor</th>
              <th className={thEstilo}>Situação</th>
              <th className={thEstilo} />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <Linha key={l.org_id} linha={l} mes={mes} hoje={hoje} />
            ))}
          </tbody>
        </Tabela>
      </div>

      <ul className="space-y-2 lg:hidden">
        {linhas.map((l) => (
          <CartaoLinha key={l.org_id} linha={l} mes={mes} hoje={hoje} />
        ))}
      </ul>
    </>
  );
}

function Linha({
  linha: l,
  mes,
  hoje,
}: {
  linha: LinhaFinanceiro;
  mes: string;
  hoje: string;
}) {
  const estado = estadoCobranca(l, hoje);

  return (
    <tr className="transition hover:bg-surface-1">
      <td className={tdEstilo}>
        <Link
          href={`/agencia/${l.org_id}/financeiro`}
          className="flex items-center gap-3 rounded-md"
        >
          <span
            aria-hidden
            className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-surface-3 text-xs font-bold text-muted"
          >
            {iniciais(l.name)}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{l.name}</span>
            <span className="block truncate font-mono text-[11.5px] text-dim">
              {l.slug}
            </span>
          </span>
        </Link>
      </td>

      <td className={`${tdEstilo} ${numEstilo}`}>
        <Vencimento linha={l} estado={estado} hoje={hoje} />
      </td>

      <td className={`${tdEstilo} ${numEstilo}`}>
        <ValorDaLinha linha={l} />
      </td>

      <td className={tdEstilo}>
        <Selo tom={TOM[estado]}>{rotuloEstado(estado)}</Selo>
      </td>

      <td className={`${tdEstilo} ${numEstilo}`}>
        <div className="flex justify-end gap-1.5">
          <Acoes linha={l} estado={estado} mes={mes} />
        </div>
      </td>
    </tr>
  );
}

function CartaoLinha({
  linha: l,
  mes,
  hoje,
}: {
  linha: LinhaFinanceiro;
  mes: string;
  hoje: string;
}) {
  const estado = estadoCobranca(l, hoje);

  return (
    <li className="rounded-lg border border-line bg-surface-1 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/agencia/${l.org_id}/financeiro`} className="min-w-0">
          <p className="truncate font-semibold">{l.name}</p>
          <p className="truncate font-mono text-[11.5px] text-dim">{l.slug}</p>
        </Link>
        <Selo tom={TOM[estado]}>{rotuloEstado(estado)}</Selo>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs tabular text-muted">
          <Vencimento linha={l} estado={estado} hoje={hoje} />
        </span>
        <span className="text-sm font-semibold tabular">
          <ValorDaLinha linha={l} />
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Acoes linha={l} estado={estado} mes={mes} />
      </div>
    </li>
  );
}

function Vencimento({
  linha: l,
  estado,
  hoje,
}: {
  linha: LinhaFinanceiro;
  estado: EstadoCobranca;
  hoje: string;
}) {
  if (estado === "sem-contrato") return <span className="text-dim">—</span>;

  // Sem cobrança gerada não existe data ainda; o que dá para dizer é o dia
  // combinado no contrato, e dizer "todo dia 10" é mais honesto que inventar
  // uma data que ninguém emitiu.
  if (!l.vencimento) {
    return (
      <span className="text-dim">
        {l.dia_vencimento ? `todo dia ${l.dia_vencimento}` : "—"}
      </span>
    );
  }

  const dias = diasDeAtraso(l.vencimento, hoje);
  return (
    <span className={estado === "atrasado" ? "font-semibold text-danger" : ""}>
      {dataCurta(l.vencimento)}
      {estado === "atrasado" ? (
        <span className="ml-1.5 text-[11.5px] font-semibold">
          {dias === 1 ? "1 dia" : `${dias} dias`}
        </span>
      ) : null}
    </span>
  );
}

function ValorDaLinha({ linha: l }: { linha: LinhaFinanceiro }) {
  // Cobrança gerada manda no número: ela é o valor congelado daquele mês. O
  // valor vigente só aparece quando ainda não há cobrança — e em cinza, para
  // não passar por dinheiro já lançado.
  if (l.valor !== null) return <>{reais(l.valor)}</>;
  if (l.valor_vigente !== null)
    return <span className="text-dim">{reais(l.valor_vigente)}</span>;
  return <span className="text-dim">—</span>;
}

function Acoes({
  linha: l,
  estado,
  mes,
}: {
  linha: LinhaFinanceiro;
  estado: EstadoCobranca;
  mes: string;
}) {
  if (estado === "sem-contrato" || estado === "nao-gerada") {
    return (
      <Link
        href={`/agencia/${l.org_id}/financeiro`}
        className={botaoEstilo("secundario", "sm")}
      >
        {estado === "sem-contrato" ? "Cadastrar" : "Ver contrato"}
      </Link>
    );
  }

  if (estado === "pago") {
    return (
      <form action={desfazerPagamento}>
        <input type="hidden" name="id" value={l.cobranca_id ?? ""} />
        <input type="hidden" name="mes" value={mes} />
        <BotaoEnviar variante="secundario" tamanho="sm" pendente="Desfazendo…">
          Desfazer
        </BotaoEnviar>
      </form>
    );
  }

  if (estado === "cancelado") {
    return (
      <form action={desfazerPagamento}>
        <input type="hidden" name="id" value={l.cobranca_id ?? ""} />
        <input type="hidden" name="mes" value={mes} />
        <BotaoEnviar variante="secundario" tamanho="sm" pendente="Reabrindo…">
          Reabrir
        </BotaoEnviar>
      </form>
    );
  }

  return (
    <>
      <DialogoPagamento linha={l} mes={mes} />
      <ConfirmarAcao
        acao={cancelarCobranca}
        rotulo="Cancelar"
        titulo="Cancelar esta cobrança?"
        descricao={
          <>
            A cobrança de <strong>{l.name}</strong> fica registrada como
            cancelada — não some da lista. Serve para o mês que, por combinado,
            não vai ser cobrado.
          </>
        }
        confirmar="Cancelar cobrança"
      >
        <input type="hidden" name="id" value={l.cobranca_id ?? ""} />
        <input type="hidden" name="mes" value={mes} />
      </ConfirmarAcao>
    </>
  );
}

function DialogoPagamento({
  linha: l,
  mes,
}: {
  linha: LinhaFinanceiro;
  mes: string;
}) {
  return (
    <Dialogo
      rotulo="Marcar pago"
      variante="secundario"
      tamanho="sm"
      titulo={`Pagamento de ${l.name}`}
      descricao={`Cobrança de ${reais(l.valor)}, vencida em ${dataCurta(l.vencimento)}.`}
    >
      <form action={marcarPago} className="space-y-3">
        <input type="hidden" name="id" value={l.cobranca_id ?? ""} />
        <input type="hidden" name="mes" value={mes} />

        <Campo rotulo="Recebido em" obrigatorio>
          <Entrada
            type="date"
            name="pago_em"
            required
            defaultValue={hojeISO()}
            autoFocus
          />
        </Campo>

        <Campo
          rotulo="Valor recebido"
          ajuda="Em branco quer dizer que veio o valor da cobrança. Preencha só se veio diferente."
        >
          <Entrada
            name="valor"
            inputMode="decimal"
            placeholder={reais(l.valor).replace("R$ ", "")}
          />
        </Campo>

        <div className="flex justify-end pt-1">
          <BotaoEnviar pendente="Salvando…">Confirmar pagamento</BotaoEnviar>
        </div>
      </form>
    </Dialogo>
  );
}
