/**
 * Faixa de recado — erro, confirmação, atenção.
 *
 * A mesma caixa vermelha estava copiada em oito páginas, sempre alimentada por
 * `?erro=` na URL. Aqui ela é uma peça só, e `role="alert"` faz o leitor de
 * tela anunciar sem que o usuário precise procurar.
 */
export type TomAviso = "erro" | "ok" | "atencao";

const TOM: Record<TomAviso, string> = {
  erro: "border-danger/40 bg-danger/10 text-danger",
  ok: "border-ok/40 bg-ok/10 text-ok",
  atencao: "border-warn/40 bg-warn/10 text-warn",
};

export function Aviso({
  tom = "erro",
  children,
}: {
  tom?: TomAviso;
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-3.5 py-2.5 text-sm ${TOM[tom]}`}
    >
      {children}
    </div>
  );
}
