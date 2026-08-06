import { createBrowserClient } from "@supabase/ssr";
import { cookieOptionsPara } from "./cookie-options";

/**
 * Supabase client para Client Components (browser).
 * Usa apenas a chave publishable/anon — nunca a secret.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieOptionsPara(
        typeof window === "undefined" ? undefined : window.location.hostname,
      ),
    },
  );
}
