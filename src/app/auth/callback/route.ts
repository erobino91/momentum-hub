import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Destino dos links que a Supabase manda por email (confirmação de cadastro e
 * recuperação de senha). Troca o `code` por uma sessão em cookie e segue.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const proximo = searchParams.get("proximo") ?? "/";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${proximo}`);
  }

  return NextResponse.redirect(
    `${origin}/login?erro=${encodeURIComponent("Link inválido ou expirado.")}`,
  );
}
