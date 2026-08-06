import { createClient } from "@supabase/supabase-js";

/**
 * Client com a chave **secreta** do projeto — passa por cima da RLS.
 *
 * Existe por dois motivos, os dois na página pública do bio, que não tem sessão:
 *   - ler `link_pages`/`link_buttons` (fechados para `anon` de propósito);
 *   - gravar em `link_clicks` e ler `link_secrets.capi_token`.
 *
 * Nunca importar de Client Component. O `throw` abaixo é a rede de segurança:
 * se este módulo entrar num bundle do navegador, quebra alto em vez de vazar a
 * chave em silêncio.
 */
export function clienteSecreto() {
  if (typeof window !== "undefined") {
    throw new Error("clienteSecreto() é server-side. Não importar no cliente.");
  }

  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SECRET_KEY não configurada.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
