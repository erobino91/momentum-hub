import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cookieOptionsPara } from "./cookie-options";

/**
 * Supabase client para Server Components, Route Handlers e Server Actions.
 * Lê/escreve a sessão nos cookies. Usa apenas a chave publishable/anon.
 */
export function createClient() {
  const cookieStore = cookies();
  const h = headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0];

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: cookieOptionsPara(host),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de um Server Component — seguro ignorar quando o
            // middleware é o responsável por renovar a sessão (Fase 1).
          }
        },
      },
    },
  );
}
