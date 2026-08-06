"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import type { TemaBio } from "@/types/bio";

/**
 * Escritas do editor de bio.
 *
 * Quem manda é a RLS: as policies de `link_pages`/`link_buttons` já limitam
 * tudo à org do usuário. As checagens daqui existem para devolver mensagem em
 * vez de erro cru — e, no caso do `capi_token`, porque a gravação precisa da
 * chave secreta (a tabela `link_secrets` é fechada até para `authenticated`),
 * então a posse tem que ser conferida antes, na mão.
 */

function voltar(caminho: string, erro?: string): never {
  revalidatePath(caminho);
  redirect(erro ? `${caminho}?erro=${encodeURIComponent(erro)}` : caminho);
}

/**
 * Toda escrita do bio é da agência. A RLS já barra (policies `*_write_agency`);
 * isto aqui evita o formulário aparecer, ser enviado e falhar com erro cru.
 */
async function exigirPagina(pageId: string) {
  const supabase = createClient();

  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect(`/bio/${pageId}`);

  const { data } = await supabase
    .from("link_pages")
    .select("id, slug")
    .eq("id", pageId)
    .maybeSingle<{ id: string; slug: string }>();
  if (!data) redirect("/bio");
  return { supabase, pagina: data };
}

/** A página pública tem cache de 60s; sem isto o cliente salva e não vê mudar. */
function limparCachePublico(slug: string) {
  revalidatePath(`/b/${slug}`);
}

/**
 * A empresa vem do formulário, não da sessão: quem cria é a agência, e a página
 * tem que nascer na empresa do cliente — senão o relatório fica na org errada.
 */
export async function criarPagina(formData: FormData) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/bio");

  const orgId = String(formData.get("org_id") ?? "");
  if (!orgId) voltar("/bio", "Escolha a empresa.");

  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase();
  const title = String(formData.get("title") ?? "").trim();

  if (!slug || !title) voltar("/bio", "Endereço e título são obrigatórios.");
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug))
    voltar("/bio", "O endereço aceita letras minúsculas, números e hífen (3 a 50).");

  const { data, error } = await supabase
    .from("link_pages")
    .insert({ org_id: orgId, slug, title })
    .select("id")
    .single();

  if (error || !data) voltar("/bio", "Não foi possível criar. Esse endereço já pode existir.");
  voltar(`/bio/${data.id}`);
}

export async function salvarPagina(formData: FormData) {
  const pageId = String(formData.get("page_id") ?? "");
  const { supabase, pagina } = await exigirPagina(pageId);

  const tema: TemaBio = {
    fundo: String(formData.get("tema_fundo") ?? "") || undefined,
    texto: String(formData.get("tema_texto") ?? "") || undefined,
    botao: String(formData.get("tema_botao") ?? "") || undefined,
    botaoTexto: String(formData.get("tema_botao_texto") ?? "") || undefined,
  };

  const pixel = String(formData.get("pixel_id") ?? "").replace(/[^0-9]/g, "");

  const { error } = await supabase
    .from("link_pages")
    .update({
      title: String(formData.get("title") ?? "").trim(),
      bio: String(formData.get("bio") ?? "").trim() || null,
      avatar_url: String(formData.get("avatar_url") ?? "").trim() || null,
      pixel_id: pixel || null,
      active: formData.get("active") === "on",
      theme: tema,
    })
    .eq("id", pageId);

  if (error) voltar(`/bio/${pageId}`, "Não foi possível salvar a página.");
  limparCachePublico(pagina.slug);
  voltar(`/bio/${pageId}`);
}

/**
 * O token de CAPI é gravado com a chave secreta e **nunca é lido de volta** para
 * a tela. O painel mostra só "configurado" ou "não configurado".
 */
export async function salvarToken(formData: FormData) {
  const pageId = String(formData.get("page_id") ?? "");
  await exigirPagina(pageId);

  const token = String(formData.get("capi_token") ?? "").trim();
  const db = clienteSecreto();

  if (!token) {
    await db.from("link_secrets").delete().eq("page_id", pageId);
    voltar(`/bio/${pageId}`);
  }

  const { error } = await db
    .from("link_secrets")
    .upsert({ page_id: pageId, capi_token: token }, { onConflict: "page_id" });

  if (error) voltar(`/bio/${pageId}`, "Não foi possível salvar o token.");
  voltar(`/bio/${pageId}`);
}

export async function criarBotao(formData: FormData) {
  const pageId = String(formData.get("page_id") ?? "");
  const { supabase, pagina } = await exigirPagina(pageId);

  const label = String(formData.get("label") ?? "").trim();
  let url = String(formData.get("url") ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

  if (!label || !url) voltar(`/bio/${pageId}`, "Texto e link são obrigatórios.");

  const { data: ultimo } = await supabase
    .from("link_buttons")
    .select("position")
    .eq("page_id", pageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle<{ position: number }>();

  const { error } = await supabase.from("link_buttons").insert({
    page_id: pageId,
    label,
    url,
    icon: String(formData.get("icon") ?? "").trim() || null,
    position: (ultimo?.position ?? -1) + 1,
  });

  if (error) voltar(`/bio/${pageId}`, "Link inválido. Confira o endereço.");
  limparCachePublico(pagina.slug);
  voltar(`/bio/${pageId}`);
}

export async function salvarBotao(formData: FormData) {
  const pageId = String(formData.get("page_id") ?? "");
  const botaoId = String(formData.get("botao_id") ?? "");
  const { supabase, pagina } = await exigirPagina(pageId);

  let url = String(formData.get("url") ?? "").trim();
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;

  const janela = (campo: string) => {
    const v = String(formData.get(campo) ?? "").trim();
    return v ? new Date(v).toISOString() : null;
  };

  const { error } = await supabase
    .from("link_buttons")
    .update({
      label: String(formData.get("label") ?? "").trim(),
      url,
      icon: String(formData.get("icon") ?? "").trim() || null,
      active: formData.get("active") === "on",
      starts_at: janela("starts_at"),
      ends_at: janela("ends_at"),
    })
    .eq("id", botaoId)
    .eq("page_id", pageId);

  if (error) voltar(`/bio/${pageId}`, "Não foi possível salvar o botão.");
  limparCachePublico(pagina.slug);
  voltar(`/bio/${pageId}`);
}

export async function apagarBotao(formData: FormData) {
  const pageId = String(formData.get("page_id") ?? "");
  const botaoId = String(formData.get("botao_id") ?? "");
  const { supabase, pagina } = await exigirPagina(pageId);

  // Os cliques ficam: `link_clicks.button_id` é `on delete set null` e o
  // `rotulo` guardado no clique mantém o relatório inteiro.
  await supabase.from("link_buttons").delete().eq("id", botaoId).eq("page_id", pageId);

  limparCachePublico(pagina.slug);
  voltar(`/bio/${pageId}`);
}

/** Recebe os ids na ordem nova; a posição é o índice. */
export async function reordenarBotoes(pageId: string, ids: string[]) {
  const { supabase, pagina } = await exigirPagina(pageId);

  await Promise.all(
    ids.map((id, i) =>
      supabase
        .from("link_buttons")
        .update({ position: i })
        .eq("id", id)
        .eq("page_id", pageId),
    ),
  );

  limparCachePublico(pagina.slug);
  revalidatePath(`/bio/${pageId}`);
}
