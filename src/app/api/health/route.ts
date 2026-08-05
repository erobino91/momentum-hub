import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Health check da Fase 0: confirma que o app está de pé e que as env vars do
 * Supabase apontam para um projeto alcançável. Não expõe chave nenhuma.
 */
export async function GET() {
  const hasEnv = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!hasEnv) {
    return NextResponse.json(
      { ok: false, supabase: "env-missing" },
      { status: 503 },
    );
  }

  try {
    const supabase = createClient();
    // Sem sessão, retorna user: null sem erro — basta para provar alcance.
    const { error } = await supabase.auth.getUser();
    const reachable = !error || error.name === "AuthSessionMissingError";
    return NextResponse.json(
      { ok: reachable, supabase: reachable ? "reachable" : "unreachable" },
      { status: reachable ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, supabase: "unreachable" },
      { status: 503 },
    );
  }
}
