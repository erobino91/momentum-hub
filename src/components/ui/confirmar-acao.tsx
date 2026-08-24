"use client";

import { useState } from "react";
import { Botao } from "./botao";
import { BotaoEnviar } from "./botao-enviar";
import { Campo, Entrada } from "./campo";
import { AcoesDialogo, Dialogo } from "./dialogo";

/**
 * Confirmação antes de destruir alguma coisa.
 *
 * Até aqui, "Apagar" um mês inteiro de faturamento era um texto cinza de 12px
 * dentro de um `<form>` — um clique errado e os 24 números do cliente saíam do
 * dashboard, sem pergunta e sem volta.
 *
 * Quando `digite` é passado, o botão só libera depois que a palavra bater. Vale
 * o custo em coisa que não dá para desfazer (apagar mês, apagar empresa); para
 * remover um produto do cardápio, a pergunta sozinha basta.
 */
export function ConfirmarAcao({
  acao,
  rotulo,
  titulo,
  descricao,
  confirmar,
  digite,
  children,
}: {
  /** Server action que executa de verdade. */
  acao: (formData: FormData) => void | Promise<void>;
  /** Texto do gatilho na lista. */
  rotulo: React.ReactNode;
  titulo: string;
  descricao: React.ReactNode;
  /** Texto do botão que confirma. */
  confirmar: string;
  /** Palavra que precisa ser digitada. Sem ela, confirma direto. */
  digite?: string;
  /** Campos escondidos que a action precisa (ids, org_id…). */
  children?: React.ReactNode;
}) {
  const [texto, setTexto] = useState("");
  const travado = Boolean(digite) && texto.trim() !== digite;

  return (
    <Dialogo
      rotulo={rotulo}
      variante="destrutivo"
      tamanho="sm"
      titulo={titulo}
      descricao={descricao}
      aoFechar={() => setTexto("")}
    >
      <form action={acao}>
        {children}

        {digite ? (
          <Campo
            rotulo={`Digite “${digite}” para confirmar`}
            className="mb-1"
          >
            <Entrada
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={digite}
              autoComplete="off"
              // Foco vai direto para o campo: é o próximo passo óbvio.
              autoFocus
            />
          </Campo>
        ) : null}

        <AcoesDialogo>
          <Botao
            variante="fantasma"
            onClick={(e) =>
              e.currentTarget.closest("dialog")?.close()
            }
          >
            Cancelar
          </Botao>
          {/* Vermelho preenchido só aqui dentro, com a intenção já declarada. */}
          <BotaoEnviar variante="perigo" pendente="Apagando…" disabled={travado}>
            {confirmar}
          </BotaoEnviar>
        </AcoesDialogo>
      </form>
    </Dialogo>
  );
}
