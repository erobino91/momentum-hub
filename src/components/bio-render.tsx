"use client";

import { useEffect, useState } from "react";
import type { PaginaPublica } from "@/types/bio";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    __bioEventId?: string;
  }
}

export function novoId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * A cara da página de bio. É a mesma peça que a página pública renderiza e que
 * o editor usa como preview — se as duas divergirem, o cliente publica uma coisa
 * e vê outra.
 *
 * `modo="preview"` só desliga a navegação e o disparo de evento.
 */
export function BioRender({
  pagina,
  modo = "publico",
}: {
  pagina: PaginaPublica;
  modo?: "publico" | "preview";
}) {
  const { tema } = pagina;
  const [fbclid, setFbclid] = useState<string | null>(null);

  // Lido no efeito, não na renderização: o servidor não conhece a query string
  // da página cacheada e a hidratação quebraria.
  useEffect(() => {
    setFbclid(new URLSearchParams(window.location.search).get("fbclid"));
  }, []);

  function aoClicar(e: React.MouseEvent<HTMLAnchorElement>, botaoId: string) {
    if (modo === "preview") {
      e.preventDefault();
      return;
    }
    e.preventDefault();

    const eventId = novoId();
    if (typeof window.fbq === "function") {
      window.fbq(
        "trackCustom",
        "BioClick",
        { content_name: pagina.slug },
        { eventID: eventId },
      );
    }

    const destino =
      `/r/${botaoId}?e=${encodeURIComponent(eventId)}` +
      (fbclid ? `&fbclid=${encodeURIComponent(fbclid)}` : "");

    // Respiro para o Pixel conseguir despachar antes da navegação cancelar a
    // requisição dele. A CAPI não depende disto — só a deduplicação depende.
    window.setTimeout(() => {
      window.location.href = destino;
    }, 120);
  }

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center px-5 py-12"
      style={{ background: tema.fundo, color: tema.texto }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          {pagina.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pagina.avatarUrl}
              alt=""
              className="h-24 w-24 rounded-full object-cover ring-2 ring-white/20"
            />
          ) : null}
          <h1 className="mt-4 text-xl font-semibold">{pagina.title}</h1>
          {pagina.bio ? (
            <p className="mt-2 whitespace-pre-line text-sm opacity-75">
              {pagina.bio}
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {pagina.botoes.length === 0 ? (
            <p className="rounded-xl border border-current/20 px-4 py-6 text-center text-sm opacity-60">
              Nenhum link publicado ainda.
            </p>
          ) : (
            pagina.botoes.map((b) => (
              <a
                key={b.id}
                href={modo === "preview" ? "#" : `/r/${b.id}`}
                onClick={(e) => aoClicar(e, b.id)}
                className="flex items-center justify-center gap-2 rounded-xl px-5 py-4 text-center text-sm font-semibold transition hover:opacity-90 active:scale-[0.99]"
                style={{ background: tema.botao, color: tema.botaoTexto }}
              >
                {b.icon ? <span aria-hidden>{b.icon}</span> : null}
                {b.label}
              </a>
            ))
          )}
        </div>

        <p className="mt-10 text-center text-[11px] opacity-40">
          Momentum Digital
        </p>
      </div>
    </div>
  );
}

/**
 * Manda o PageView para o nosso servidor, que repete na CAPI.
 *
 * Sai sempre — inclusive com bloqueador de anúncio ligado, que é justamente
 * quando o Pixel não carrega. Reaproveita o `event_id` que o snippet do Pixel
 * gerou; quando o Pixel foi bloqueado, esse id não existe e um novo é criado,
 * então não há par para deduplicar (nem precisa: só um lado contou).
 */
export function BeaconPageview({ slug }: { slug: string }) {
  useEffect(() => {
    const disparar = () => {
      const eventId = window.__bioEventId ?? novoId();
      const fbclid = new URLSearchParams(window.location.search).get("fbclid");
      fetch("/api/bio/pv", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, eventId, fbclid }),
      }).catch(() => {});
    };
    // Espera o snippet do Pixel rodar para reaproveitar o mesmo event_id.
    const t = window.setTimeout(disparar, 300);
    return () => window.clearTimeout(t);
  }, [slug]);

  return null;
}
