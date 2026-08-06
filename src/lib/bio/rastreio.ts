import { createHash } from "node:crypto";

/**
 * Coleta de dados do visitante e envio para a Conversions API da Meta.
 *
 * Duas decisões que parecem contraditórias e não são:
 *
 * - **No nosso banco o IP nunca é gravado cru** — só `sha256(sal + ip)`. É o que
 *   a LGPD pede e ainda dá para contar visitante único.
 * - **Para a Meta o IP e o User-Agent vão crus.** `client_ip_address` e
 *   `client_user_agent` são os dois únicos campos que a CAPI exige *sem* hash;
 *   mandá-los hasheados não dá erro, simplesmente zera o casamento com o
 *   usuário e o evento vira lixo. Quem é hasheado é email/telefone — que aqui
 *   não existem.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export type DadosVisitante = {
  ip: string | null;
  ipHash: string | null;
  ua: string | null;
  referrer: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  country: string | null;
  city: string | null;
};

function primeiro(valor: string | null): string | null {
  if (!valor) return null;
  const v = valor.split(",")[0]?.trim();
  return v || null;
}

/**
 * A Vercel manda a geo percent-encoded — "Olímpia" chega como "Ol%C3%ADmpia".
 * Sem isto o relatório mostraria o texto codificado.
 */
function decodificar(valor: string | null): string | null {
  if (!valor) return null;
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

export function hashIp(ip: string | null): string | null {
  const sal = process.env.BIO_IP_SALT;
  if (!ip || !sal) return null;
  return createHash("sha256").update(`${sal}:${ip}`).digest("hex");
}

/**
 * @param fbclidUrl o `fbclid` da URL da página de bio, repassado pelo botão —
 * o `_fbc` só existe se o Pixel tiver carregado, e com bloqueador ele não carrega.
 */
export function lerVisitante(
  headers: Headers,
  cookies: { get(nome: string): { value: string } | undefined },
  fbclidUrl?: string | null,
): DadosVisitante {
  const ip =
    primeiro(headers.get("x-forwarded-for")) ?? headers.get("x-real-ip");
  const fbclid = fbclidUrl ?? null;
  const fbcCookie = cookies.get("_fbc")?.value ?? null;

  return {
    ip,
    ipHash: hashIp(ip),
    ua: headers.get("user-agent"),
    referrer: headers.get("referer"),
    fbclid,
    fbp: cookies.get("_fbp")?.value ?? null,
    // Sem cookie do Pixel, o `fbc` é montado no formato que a Meta espera.
    fbc: fbcCookie ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : null),
    country: decodificar(headers.get("x-vercel-ip-country")),
    city: decodificar(headers.get("x-vercel-ip-city")),
  };
}

export type EventoCapi = {
  pixelId: string;
  token: string;
  eventName: string;
  /** O MESMO id que o Pixel do navegador mandou. É o que faz a Meta deduplicar. */
  eventId: string;
  eventSourceUrl: string;
  visitante: DadosVisitante;
  customData?: Record<string, unknown>;
};

export type ResultadoCapi = {
  ok: boolean;
  status: number | null;
  erro?: string;
};

/**
 * Manda o evento e devolve o que aconteceu. Nunca lança: um clique não pode
 * deixar de redirecionar porque a Meta demorou. Por isso também o timeout curto.
 */
export async function enviarCapi(evento: EventoCapi): Promise<ResultadoCapi> {
  const { visitante: v } = evento;

  const userData: Record<string, unknown> = {};
  if (v.ip) userData.client_ip_address = v.ip;
  if (v.ua) userData.client_user_agent = v.ua;
  if (v.fbp) userData.fbp = v.fbp;
  if (v.fbc) userData.fbc = v.fbc;

  const corpo = {
    data: [
      {
        event_name: evento.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: evento.eventId,
        event_source_url: evento.eventSourceUrl,
        action_source: "website",
        user_data: userData,
        ...(evento.customData ? { custom_data: evento.customData } : {}),
      },
    ],
  };

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), 1500);

  try {
    const r = await fetch(
      `${GRAPH}/${evento.pixelId}/events?access_token=${encodeURIComponent(evento.token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        signal: controle.signal,
        cache: "no-store",
      },
    );
    if (r.ok) return { ok: true, status: r.status };
    const texto = await r.text();
    return { ok: false, status: r.status, erro: texto.slice(0, 300) };
  } catch (e) {
    return {
      ok: false,
      status: null,
      erro: e instanceof Error ? e.message : "falha na chamada",
    };
  } finally {
    clearTimeout(relogio);
  }
}
