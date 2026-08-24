"use client";

import { useCallback, useRef } from "react";
import { Botao, type TamanhoBotao, type VarianteBotao } from "./botao";

/**
 * Diálogo modal em cima do `<dialog>` do navegador — sem biblioteca.
 *
 * O elemento nativo já entrega de graça o que uma implementação em `div` erra:
 * foco preso dentro do modal, Esc fechando, `inert` no resto da página e
 * anúncio correto no leitor de tela.
 *
 * Serve para tirar da tela os formulários que hoje vivem sempre abertos — o
 * "Dar acesso ao portal" está montado dez vezes em `/agencia`, uma por empresa,
 * com o campo da senha do cliente à mostra.
 */
export function Dialogo({
  rotulo,
  variante = "secundario",
  tamanho = "md",
  titulo,
  descricao,
  aoFechar,
  className = "",
  children,
}: {
  /** Texto do botão que abre. */
  rotulo: React.ReactNode;
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  titulo: string;
  descricao?: React.ReactNode;
  /** Chamado ao fechar, de qualquer jeito — Esc, fundo, × ou envio. */
  aoFechar?: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  const fechar = useCallback(() => ref.current?.close(), []);

  return (
    <>
      <Botao
        variante={variante}
        tamanho={tamanho}
        onClick={() => ref.current?.showModal()}
      >
        {rotulo}
      </Botao>

      <dialog
        ref={ref}
        // O evento `close` do elemento cobre todas as saídas — inclusive o Esc,
        // que o navegador trata sozinho e não passa por nenhum handler nosso.
        onClose={aoFechar}
        // Clique no fundo fecha: fora da caixa, o alvo do clique é o próprio
        // `<dialog>`; dentro, é algum filho.
        onClick={(e) => {
          if (e.target === ref.current) fechar();
        }}
        // Qualquer formulário daqui de dentro fecha ao enviar; a página
        // revalida em seguida e mostra o resultado.
        onSubmit={() => fechar()}
        className={`w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line-strong bg-surface-2 p-0 text-foreground shadow-2xl backdrop:bg-canvas/80 ${className}`}
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{titulo}</h2>
              {descricao ? (
                <div className="mt-1.5 text-sm leading-relaxed text-muted">
                  {descricao}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={fechar}
              aria-label="Fechar"
              className="-mr-1 -mt-1 rounded-md px-2 py-1 text-lg leading-none text-dim transition hover:bg-surface-3 hover:text-foreground"
            >
              ×
            </button>
          </div>
          <div className="mt-4">{children}</div>
        </div>
      </dialog>
    </>
  );
}

/** Linha de botões do rodapé de um diálogo — principal à direita. */
export function AcoesDialogo({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex justify-end gap-2">{children}</div>;
}
