import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { hojeISO } from "@/lib/data";
import { lerEvento } from "@/lib/asaas";

/**
 * O ASAAS avisa aqui quando um pagamento muda.
 *
 * A autenticação é o token cadastrado junto com o webhook no painel do ASAAS,
 * que volta no header `asaas-access-token` — o mesmo valor de
 * `ASAAS_WEBHOOK_TOKEN`.
 *
 * Evento que não interessa responde 200: o ASAAS pausa a fila inteira depois
 * de falhas seguidas, e um evento ignorado não é falha. Erro de banco responde
 * 500 de propósito, para ele tentar de novo.
 */

export const dynamic = "force-dynamic";

function iguais(a: string, b: string) {
  // Hash antes de comparar: `timingSafeEqual` exige o mesmo tamanho.
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

export async function POST(request: NextRequest) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  const recebido = request.headers.get("asaas-access-token") ?? "";
  if (!esperado || !iguais(recebido, esperado)) {
    return new NextResponse(null, { status: 401 });
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const acao = lerEvento(corpo, hojeISO());
  if (!acao) return NextResponse.json({ ok: true });

  const db = clienteSecreto();
  const { error } =
    acao.tipo === "pago"
      ? await db
          .from("billing_charges")
          .update({ status: "pago", pago_em: acao.data })
          .eq("asaas_payment_id", acao.id)
          // Só pendente vira pago: cancelado no hub não ressuscita, e pago à
          // mão já tem a data certa.
          .eq("status", "pendente")
      : await db
          .from("billing_charges")
          .update({ asaas_payment_id: null, asaas_url: null })
          .eq("asaas_payment_id", acao.id);

  if (error) return new NextResponse(null, { status: 500 });
  return NextResponse.json({ ok: true });
}
