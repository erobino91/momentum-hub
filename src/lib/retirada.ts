import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { clienteSecreto } from "@/lib/supabase/secreto";

/**
 * Página de retirada de venda antecipada: lista os pedidos de um produto no
 * Goomer, com busca e botão "Retirado".
 *
 * Evento novo = uma entrada aqui + as duas variáveis de ambiente (token da loja
 * no Goomer e PIN do balcão). Sem tela de cadastro: é ação pontual.
 */
type Evento = {
  titulo: string;
  /** Trecho do nome do item no Goomer, sem diferenciar maiúscula. */
  produto: string;
  /** Dias da venda (data local); o Goomer aceita um dia por consulta. */
  dias: string[];
  tokenEnv: string;
  pinEnv: string;
};

const EVENTOS: Record<string, Evento> = {
  blackbbo: {
    titulo: "Black BB Onça · retirada quinta 26/11",
    produto: "SEU MUFASA - O REI", // TESTE: voltar para "MUFASA BLACK"
    dias: ["2026-11-23"], // TESTE: voltar para ["2026-11-25"]
    tokenEnv: "GOOMER_TOKEN_BB_ONCA",
    pinEnv: "RETIRADA_PIN_BLACKBBO",
  },
};

export function evento(slug: string) {
  return EVENTOS[slug] ?? null;
}

export type ItemPedido = { nome: string; qtd: number };
export type PedidoRetirada = {
  id: string;
  numero: string;
  nome: string;
  fone: string; // só os 4 últimos dígitos
  criadoEm: string;
  lanches: number;
  itens: ItemPedido[];
  retiradoEm: string | null;
};

// ---------------------------------------------------------------- PIN

const cookieNome = (slug: string) => `retirada_${slug}`;
const hashPin = (slug: string, pin: string) =>
  createHash("sha256").update(`${slug}:${pin}`).digest("hex");

export function pinConfere(slug: string, pin: string) {
  const ev = evento(slug);
  const certo = ev && process.env[ev.pinEnv];
  return !!certo && pin.trim() === certo;
}

export function gravarAcesso(slug: string, pin: string) {
  cookies().set(cookieNome(slug), hashPin(slug, pin.trim()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/retirada",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function temAcesso(slug: string) {
  const ev = evento(slug);
  const pin = ev && process.env[ev.pinEnv];
  if (!pin) return false;
  return cookies().get(cookieNome(slug))?.value === hashPin(slug, pin);
}

// ---------------------------------------------------------------- Goomer

type PedidoGoomer = {
  id: string;
  displayId?: string;
  createdAt: string;
  customer?: { name?: string; phone?: { number?: string } };
  items?: { name: string; quantity: number; totalPrice?: { value: number } }[];
};

async function pedidosDoDia(token: string, dia: string) {
  const todos: PedidoGoomer[] = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const url = new URL("https://partner-api.goomer.app/partner/v1/orders/history");
    // Retirada no balcão vem como DELIVERY com taxa zero; não existe tipo próprio.
    url.search = new URLSearchParams({
      type: "DELIVERY",
      startDate: dia,
      endDate: dia,
      page: String(page),
      perPage: "100",
    }).toString();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Goomer ${res.status} em ${dia}`);
    const body = await res.json();
    todos.push(...(body.data ?? []));
    total = body.pagination?.totalPages ?? 1;
  }
  return todos;
}

export async function carregarPedidos(slug: string): Promise<PedidoRetirada[]> {
  const ev = evento(slug)!;
  const token = process.env[ev.tokenEnv];
  if (!token) throw new Error(`${ev.tokenEnv} não configurada.`);

  const alvo = ev.produto.toLowerCase();
  const brutos = (await Promise.all(ev.dias.map((d) => pedidosDoDia(token, d)))).flat();

  const { data: marcados, error } = await clienteSecreto()
    .from("retiradas")
    .select("order_id, retirado_em")
    .eq("evento", slug);
  if (error) throw error;
  const retirado = new Map(marcados.map((m) => [m.order_id, m.retirado_em as string]));

  return brutos
    .filter((p) => p.items?.some((i) => i.name.toLowerCase().includes(alvo)))
    .map((p) => {
      // O histórico mistura produto com opção grátis (molho, guardanapo): fica
      // só o que tem preço, que é o que a cozinha monta.
      const itens = (p.items ?? [])
        .filter((i) => (i.totalPrice?.value ?? 0) > 0.01)
        .map((i) => ({ nome: i.name, qtd: i.quantity }));
      return {
        id: p.id,
        numero: p.displayId ?? p.id,
        nome: (p.customer?.name ?? "").trim() || "Sem nome",
        fone: (p.customer?.phone?.number ?? "").replace(/\D/g, "").slice(-4),
        criadoEm: p.createdAt,
        lanches: itens
          .filter((i) => i.nome.toLowerCase().includes(alvo))
          .reduce((s, i) => s + i.qtd, 0),
        itens,
        retiradoEm: retirado.get(p.id) ?? null,
      };
    })
    .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
}
