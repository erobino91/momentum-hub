/**
 * Opções de cookie compartilhadas pelos três clients Supabase (browser, server,
 * middleware).
 *
 * É ISTO que habilita o SSO entre os subdomínios: com `domain: '.mmtdigital.com.br'`
 * o cookie de sessão gravado em `portal.` é enviado também para `fila.` e `cmv.`.
 * Sem rota de handoff, sem JWT customizado.
 *
 * O domínio só é aplicado quando o host atual pertence a ele. O navegador
 * descarta um `Set-Cookie` cujo `Domain` não casa com o host — e um cookie
 * descartado significa sessão que não persiste, ou seja, login em loop. Então
 * em `localhost` e em `*.vercel.app` o cookie volta a ser host-only e tudo
 * funciona; o SSO liga sozinho quando o DNS apontar.
 */
const DOMINIO = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export function cookieOptionsPara(hostname: string | undefined) {
  if (!DOMINIO || !hostname) return undefined;
  const base = DOMINIO.replace(/^\./, "");
  const pertence = hostname === base || hostname.endsWith(`.${base}`);
  return pertence ? { domain: DOMINIO } : undefined;
}
