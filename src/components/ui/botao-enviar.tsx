"use client";

import { useFormStatus } from "react-dom";
import { Botao, Rodinha, type TamanhoBotao, type VarianteBotao } from "./botao";

/**
 * Botão de enviar que sabe que está enviando.
 *
 * Só um formulário do projeto inteiro fazia isso (o de dar acesso). Em todos os
 * outros, clicar recarregava a página sem sinal nenhum — e no fechamento do
 * mês, com 24 campos preenchidos, a dúvida "salvou?" leva ao segundo clique.
 *
 * `useFormStatus` precisa estar em um filho do `<form>`; é por isso que este é
 * um componente separado e não um `Botao` com uma prop.
 */
export function BotaoEnviar({
  children,
  pendente: rotuloPendente,
  variante = "primario",
  tamanho = "md",
  className = "",
  disabled,
}: {
  children: React.ReactNode;
  /** Texto durante o envio. Sem isto, mantém o mesmo texto. */
  pendente?: string;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Botao
      type="submit"
      variante={variante}
      tamanho={tamanho}
      className={className}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <>
          <Rodinha />
          {rotuloPendente ?? children}
        </>
      ) : (
        children
      )}
    </Botao>
  );
}
