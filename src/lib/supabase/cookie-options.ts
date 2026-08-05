/**
 * Opções de cookie compartilhadas pelos três clients Supabase (browser, server,
 * middleware).
 *
 * É ISTO que habilita o SSO entre os subdomínios: com `domain: '.mmtdigital.com.br'`
 * o cookie de sessão gravado em `portal.` é enviado também para `fila.` e `cmv.`.
 * Sem rota de handoff, sem JWT customizado.
 *
 * Em desenvolvimento (localhost) a variável fica vazia e o cookie volta ao
 * comportamento padrão (host-only) — navegador rejeita `domain` que não casa
 * com o host atual.
 */
const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export const cookieOptions = domain ? { domain } : undefined;
