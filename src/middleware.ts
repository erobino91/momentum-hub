import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** `bio.mmtdigital.com.br` — e `bio.localhost` para testar o roteamento local. */
function ehHostBio(hostname: string) {
  return hostname === "bio.localhost" || hostname.startsWith("bio.");
}

/**
 * Rotas que existem para o público: a página de bio, o desvio de clique e o
 * beacon de PageView. Não passam pela renovação de sessão — não há sessão.
 */
function ehPublica(pathname: string) {
  return (
    pathname.startsWith("/b/") ||
    pathname.startsWith("/r/") ||
    pathname.startsWith("/api/bio/")
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Do header, não de `nextUrl.hostname`: em `next start` o `nextUrl` é montado
  // a partir da configuração do servidor e devolve sempre `localhost`, então o
  // roteamento por domínio nunca dispararia.
  const hostname = (
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    request.nextUrl.hostname
  ).split(":")[0];

  if (ehHostBio(hostname)) {
    // Em `bio.` a raiz não é o portal — manda para o site da agência.
    if (pathname === "/") {
      return NextResponse.redirect("https://www.mmtdigital.com.br");
    }
    // `/<slug>` vira `/b/<slug>`. `/r/...` e `/api/bio/...` passam direto,
    // senão o clique e o beacon quebrariam no domínio público.
    if (!ehPublica(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = `/b${pathname}`;
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  if (ehPublica(pathname)) return NextResponse.next();

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Tudo, menos estáticos e imagens. `/api/health` fica de fora para o
     * monitoramento não bater em redirect de login.
     */
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
