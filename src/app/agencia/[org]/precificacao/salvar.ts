"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { VariaveisPreco } from "@/lib/precificacao";

export type ResultadoPrecificacao = { ok: true } | { erro: string };

/**
 * Salva variáveis e preços de uma vez.
 *
 * Antes, cada linha da tabela era um `<form>` com um botão "ok": mudar o preço
 * de um produto recarregava a página inteira. Com 96 produtos na S-HOUSE, um
 * reajuste era 96 recarregamentos — e cada um perdia a posição da rolagem e o
 * filtro digitado.
 *
 * Esta action é chamada direto do componente (não por `action={}` de
 * formulário) porque a tabela **não pode** ser um `<form>`: cada linha tem o
 * diálogo de remover, que é um formulário — e formulário dentro de formulário é
 * HTML inválido.
 */
export async function salvarPrecificacao(
  orgId: string,
  variaveis: VariaveisPreco,
  alteracoes: { id: string; preco_balcao: number }[],
): Promise<ResultadoPrecificacao> {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");
  if (!orgId) return { erro: "Empresa inválida." };

  const { error: erroCfg } = await supabase.from("pricing_config").upsert(
    {
      org_id: orgId,
      taxa_extra: variaveis.taxa_extra,
      campanha: variaveis.campanha,
      entrega: variaveis.entrega,
      cupom: variaveis.cupom,
    },
    { onConflict: "org_id" },
  );
  if (erroCfg) return { erro: "Não foi possível salvar as variáveis." };

  // Só as linhas mexidas. O `eq("org_id")` repete o que a RLS já garante — é a
  // segunda tranca em uma escrita que recebe id vindo do navegador.
  for (const alteracao of alteracoes) {
    if (!Number.isFinite(alteracao.preco_balcao) || alteracao.preco_balcao <= 0) {
      return { erro: "Há preço de balcão zerado ou inválido." };
    }
    const { error } = await supabase
      .from("pricing_products")
      .update({ preco_balcao: alteracao.preco_balcao })
      .eq("id", alteracao.id)
      .eq("org_id", orgId);
    if (error) return { erro: "Não foi possível salvar os preços." };
  }

  revalidatePath(`/agencia/${orgId}/precificacao`);
  return { ok: true };
}
