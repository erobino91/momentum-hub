import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Campos de formulário.
 *
 * Duas correções em relação ao que existia:
 *
 * 1. **Rótulo visível.** Metade dos formulários da agência usava só
 *    `placeholder` ("Nome", "slug-da-empresa"). Placeholder some quando se
 *    começa a digitar, e no celular vira uma pilha de caixas sem legenda.
 * 2. **16px no celular.** Abaixo disso o Safari do iPhone dá zoom sozinho ao
 *    focar o campo e a tela fica torta. Daí `text-base sm:text-sm`.
 */
export const campoEstilo = [
  "w-full min-h-11 rounded-md border border-line-strong bg-surface-2 px-3 py-2",
  "text-base text-foreground outline-none transition",
  "placeholder:text-dim focus:border-brand",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "sm:min-h-10 sm:text-sm",
].join(" ");

/**
 * Envolve o controle em um `<label>` — associação sem precisar inventar `id`.
 * `erro` aparece **junto do campo**, não numa faixa no topo da página.
 */
export function Campo({
  rotulo,
  ajuda,
  erro,
  obrigatorio,
  className = "",
  children,
}: {
  rotulo: string;
  ajuda?: string;
  erro?: string;
  obrigatorio?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-muted">
        {rotulo}
        {obrigatorio ? <span className="ml-0.5 text-brand-ink">*</span> : null}
      </span>
      {children}
      {erro ? (
        <span role="alert" className="mt-1.5 block text-xs text-danger">
          {erro}
        </span>
      ) : ajuda ? (
        <span className="mt-1.5 block text-xs text-dim">{ajuda}</span>
      ) : null}
    </label>
  );
}

export function Entrada({
  className = "",
  invalido,
  ...resto
}: InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean }) {
  return (
    <input
      aria-invalid={invalido || undefined}
      className={`${campoEstilo} ${invalido ? "border-danger" : ""} ${className}`}
      {...resto}
    />
  );
}

export function Selecao({
  className = "",
  ...resto
}: SelectHTMLAttributes<HTMLSelectElement>) {
  // O menu aberto é desenhado pelo sistema: sem `bg` explícito nas opções, o
  // Chrome no Windows abre uma lista branca com texto branco.
  return <select className={`${campoEstilo} ${className}`} {...resto} />;
}

export function AreaTexto({
  className = "",
  ...resto
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`${campoEstilo} py-2.5 ${className}`} {...resto} />
  );
}

/** Fundo das `<option>` — o sistema não herda o tema escuro da página. */
export const opcaoEstilo = "bg-surface-2 text-foreground";
