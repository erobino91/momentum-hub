import {
  AcoesDialogo,
  AreaTexto,
  BotaoEnviar,
  Campo,
  Dialogo,
  Entrada,
  Selecao,
  opcaoEstilo,
} from "@/components/ui";
import { formatarDinheiro } from "@/lib/numero";
import { hojeISO, reais, FORMAS, SITUACOES } from "@/lib/financeiro";
import type { BillingContract, Org } from "@/types/db";
import {
  reajustar,
  salvarContrato,
} from "@/app/agencia/[org]/financeiro/actions";

/**
 * Criar ou editar o contrato. O campo de valor só aparece na criação: depois
 * disso, mudar preço é reajuste, e reajuste precisa de data de vigência.
 */
export function DialogoContrato({
  org,
  contrato,
  temValor,
}: {
  org: Pick<Org, "id" | "name">;
  contrato: BillingContract | null;
  temValor: boolean;
}) {
  const novo = !contrato;

  return (
    <Dialogo
      rotulo={novo ? "Cadastrar contrato" : "Editar contrato"}
      variante={novo ? "primario" : "secundario"}
      tamanho="sm"
      titulo={novo ? `Contrato de ${org.name}` : "Editar contrato"}
      descricao={
        novo
          ? "O que a empresa paga e quando. Sem isto ela não entra na geração do mês."
          : "O valor não se muda por aqui — trocar preço é reajuste, e reajuste tem data de vigência."
      }
    >
      <form action={salvarContrato} className="space-y-3">
        <input type="hidden" name="org_id" value={org.id} />

        {novo || !temValor ? (
          <Campo
            rotulo="Mensalidade"
            obrigatorio={novo}
            ajuda="Passa a valer a partir de “cliente desde”, ou de hoje se estiver em branco."
          >
            <Entrada
              name="valor"
              inputMode="decimal"
              placeholder="1.500,00"
              required={novo}
              autoFocus
            />
          </Campo>
        ) : null}

        <Campo
          rotulo="Dia do vencimento"
          obrigatorio
          ajuda="De 1 a 31. Escolher 31 vira o último dia nos meses curtos."
        >
          <Entrada
            type="number"
            name="dia_vencimento"
            min={1}
            max={31}
            required
            defaultValue={contrato?.dia_vencimento ?? 10}
          />
        </Campo>

        <Campo rotulo="Situação" obrigatorio>
          <Selecao name="situacao" defaultValue={contrato?.situacao ?? "ativo"}>
            {SITUACOES.map((s) => (
              <option key={s.valor} value={s.valor} className={opcaoEstilo}>
                {s.rotulo}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Forma de pagamento">
          <Selecao
            name="forma_pagamento"
            defaultValue={contrato?.forma_pagamento ?? ""}
          >
            <option value="" className={opcaoEstilo}>
              Não definida
            </option>
            {FORMAS.map((f) => (
              <option key={f.valor} value={f.valor} className={opcaoEstilo}>
                {f.rotulo}
              </option>
            ))}
          </Selecao>
        </Campo>

        <Campo rotulo="Cliente desde">
          <Entrada
            type="date"
            name="cliente_desde"
            defaultValue={contrato?.cliente_desde ?? ""}
          />
        </Campo>

        <Campo rotulo="Observação" ajuda="Combinados fora do padrão: permuta, desconto, condição especial.">
          <AreaTexto
            name="observacao"
            rows={3}
            defaultValue={contrato?.observacao ?? ""}
          />
        </Campo>

        <AcoesDialogo>
          <BotaoEnviar pendente="Salvando…">
            {novo ? "Cadastrar contrato" : "Salvar"}
          </BotaoEnviar>
        </AcoesDialogo>
      </form>
    </Dialogo>
  );
}

export function DialogoReajuste({
  orgId,
  contratoId,
  atual,
}: {
  orgId: string;
  contratoId: string;
  atual: number | null;
}) {
  return (
    <Dialogo
      rotulo={atual === null ? "Definir valor" : "Reajustar"}
      variante="secundario"
      tamanho="sm"
      titulo="Novo valor da mensalidade"
      descricao={
        atual === null
          ? "Sem valor registrado, a empresa não entra na geração de cobranças."
          : `Hoje são ${reais(atual)}. As cobranças já geradas não mudam.`
      }
    >
      <form action={reajustar} className="space-y-3">
        <input type="hidden" name="org_id" value={orgId} />
        <input type="hidden" name="contrato_id" value={contratoId} />

        <Campo rotulo="Novo valor" obrigatorio>
          <Entrada
            name="valor"
            inputMode="decimal"
            required
            autoFocus
            placeholder={atual === null ? "1.500,00" : formatarDinheiro(atual)}
          />
        </Campo>

        <Campo
          rotulo="Passa a valer em"
          obrigatorio
          ajuda="Mês gerado antes desta data mantém o valor antigo."
        >
          <Entrada
            type="date"
            name="vigente_desde"
            required
            defaultValue={hojeISO()}
          />
        </Campo>

        <AcoesDialogo>
          <BotaoEnviar pendente="Salvando…">Salvar valor</BotaoEnviar>
        </AcoesDialogo>
      </form>
    </Dialogo>
  );
}
