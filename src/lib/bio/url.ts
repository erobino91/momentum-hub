/**
 * Endereço público do bio, só para exibir e copiar no painel. O link de teste
 * do painel aponta para `/b/<slug>` no host atual — em `localhost` e em preview
 * o domínio `bio.` não existe.
 */
export const URL_BIO = (
  process.env.NEXT_PUBLIC_BIO_URL ?? "bio.mmtdigital.com.br"
).replace(/^https?:\/\//, "");
