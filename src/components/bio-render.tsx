"use client";

import { useEffect, useState } from "react";
import { NICHOS, nichoDe, tintaSobre } from "@/lib/bio/nichos";
import type { BotaoPublico, PaginaPublica } from "@/types/bio";

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
 * São dois visuais: o **clássico** (o linktree neutro de sempre) e a **Vitrine**,
 * usada pelos nichos. A Vitrine é um layout só; o nicho muda paleta, textura e
 * forma dos cartões, tudo vindo de `@/lib/bio/nichos`.
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

  const nicho = nichoDe(tema.nicho);
  const definicao = NICHOS[nicho];
  const vitrine = nicho !== "classico";

  const fundo = tema.fundo2
    ? `linear-gradient(170deg, ${tema.fundo} 0%, ${tema.fundo2} 100%)`
    : tema.fundo;

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

  const href = (id: string) => (modo === "preview" ? "#" : `/r/${id}`);

  /** Cartão da Vitrine. O CTA é o cheio; o resto ganha o filete de cor. */
  function Cartao({ botao, ordem }: { botao: BotaoPublico; ordem: number }) {
    const cta = botao.destaque;
    return (
      <a
        href={href(botao.id)}
        onClick={(e) => aoClicar(e, botao.id)}
        className={`bio-cartao${cta ? " bio-cartao-cta" : ""}`}
        style={
          {
            "--ordem": ordem,
            background: cta ? tema.destaque : tema.botao,
            color: cta ? tintaSobre(tema.destaque) : tema.botaoTexto,
          } as React.CSSProperties
        }
      >
        {cta ? null : <span className="bio-cartao-filete" aria-hidden />}
        {botao.icon ? (
          <span aria-hidden className="text-xl leading-none">
            {botao.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">{botao.label}</span>
        <span aria-hidden className="bio-seta shrink-0 opacity-70">
          →
        </span>
      </a>
    );
  }

  return (
    <div
      className={`relative flex min-h-screen w-full flex-col items-center px-5 py-12${
        vitrine ? ` bio-vitrine bio-forma-${definicao.forma}` : ""
      }`}
      style={
        {
          background: fundo,
          color: tema.texto,
          // Lida pelo filete dos cartões, em `globals.css`.
          "--bio-destaque": tema.destaque,
        } as React.CSSProperties
      }
    >
      {vitrine && definicao.textura ? (
        <div className={`bio-texturas ${definicao.textura}`} aria-hidden />
      ) : null}

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          {pagina.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pagina.avatarUrl}
              alt=""
              className={
                vitrine
                  ? "h-28 w-28 rounded-full object-cover"
                  : "h-24 w-24 rounded-full object-cover ring-2 ring-white/20"
              }
              // O anel é `box-shadow` e não `ring-*`: a cor vem do tema, e
              // utilitária de anel com cor arbitrária não é gerada em build.
              style={vitrine ? { boxShadow: `0 0 0 4px ${tema.destaque}` } : undefined}
            />
          ) : null}
          <h1
            className={
              vitrine ? "mt-5 text-2xl font-extrabold tracking-tight" : "mt-4 text-xl font-semibold"
            }
          >
            {pagina.title}
          </h1>
          {pagina.bio ? (
            <p className="mt-2 whitespace-pre-line text-sm opacity-75">
              {pagina.bio}
            </p>
          ) : null}
        </div>

        <div className={vitrine ? "mt-8 flex flex-col gap-3.5" : "mt-8 flex flex-col gap-3"}>
          {pagina.botoes.length === 0 ? (
            <p className="rounded-xl border border-current/20 px-4 py-6 text-center text-sm opacity-60">
              Nenhum link publicado ainda.
            </p>
          ) : vitrine ? (
            pagina.botoes.map((b, i) => <Cartao key={b.id} botao={b} ordem={i} />)
          ) : (
            pagina.botoes.map((b) => (
              <a
                key={b.id}
                href={href(b.id)}
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
