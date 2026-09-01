"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clienteSecreto } from "@/lib/supabase/secreto";
import { nichoDe } from "@/lib/bio/nichos";
import type { TemaBio } from "@/types/bio";

/**
 * Escritas do editor de bio.
 *
 * Quem manda é a RLS: as policies de `link_pages`/`link_buttons` já limitam
 * tudo à org do usuário. As checagens daqui existem para devolver mensagem em
 * vez de erro cru — e, no caso do `capi_token`, porque a gravação precisa da
 * chave secreta (a tabela `link_secrets` é fechada até para `authenticated`),
 * então a posse tem que ser conferida antes, na mão.
 *
 * **Nenhuma action de editor redireciona.** O editor é um builder: a página
 * inteira mora no estado do navegador e o preview lê esse estado. Redirecionar
 * ao salvar (era o que `salvarPagina`, `criarBotao` e companhia faziam) troca a
 * árvore por baixo e leva junto tudo que ainda não foi gravado — foi assim que
 * escolher um nicho e adicionar um botão em seguida devolvia a página ao visual
 * padrão. Quem redireciona é só `criarPagina`, que muda de tela de propósito.
 */

export type ResultadoBio = { ok: true; em: number } | { erro: string } | null;

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

/* -------------------------------------------------------------------------- */
/*  Salvar a bio inteira                                                       */
/* -------------------------------------------------------------------------- */

type BotaoEnviado = {
  id: string;
  label: string;
  url: string;
  icon: string;
  destaque: boolean;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COR = /^#[0-9a-f]{6}$/i;

function comoTexto(v: unknown, limite = 400): string {
  return typeof v === "string" ? v.trim().slice(0, limite) : "";
}

function comoCor(v: unknown): string | undefined {
  const t = comoTexto(v, 7);
  return COR.test(t) ? t : undefined;
}

/** `datetime-local` chega sem fuso; o `Date` do servidor completaria errado. */
function comoInstante(v: unknown): string | null {
  const t = comoTexto(v, 40);
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Salva página e botões numa tacada só.
 *
 * O payload chega em JSON num campo escondido porque `FormData` plano não
 * expressa lista ordenada — e a ordem dos botões é dado, não enfeite. Como ele
 * vem do navegador, nada aqui é aproveitado sem passar por validação: cor tem
 * que casar `#rrggbb`, nicho tem que existir em `NICHOS`, id de botão tem que
 * ser uuid, e `page_id` é sempre o do servidor, nunca o que veio no pacote.
 */
export async function salvarBio(
  _anterior: ResultadoBio,
  formData: FormData,
): Promise<ResultadoBio> {
  const pageId = String(formData.get("page_id") ?? "");
  const { supabase, pagina } = await exigirPagina(pageId);

  let bruto: Record<string, unknown>;
  try {
    const texto = String(formData.get("dados") ?? "");
    const lido: unknown = JSON.parse(texto);
    if (!lido || typeof lido !== "object") throw new Error("formato");
    bruto = lido as Record<string, unknown>;
  } catch {
    return { erro: "Não deu para ler as alterações. Recarregue a página." };
  }

  const title = comoTexto(bruto.title, 120);
  if (!title) return { erro: "O título não pode ficar vazio." };

  const temaBruto = (bruto.theme ?? {}) as Record<string, unknown>;
  const tema: TemaBio = {
    fundo: comoCor(temaBruto.fundo),
    fundo2: comoCor(temaBruto.fundo2),
    texto: comoCor(temaBruto.texto),
    botao: comoCor(temaBruto.botao),
    botaoTexto: comoCor(temaBruto.botaoTexto),
    destaque: comoCor(temaBruto.destaque),
    nicho: nichoDe(comoTexto(temaBruto.nicho, 20)),
  };

  const lista = Array.isArray(bruto.botoes) ? bruto.botoes : [];
  const botoes: BotaoEnviado[] = [];

  for (const item of lista) {
    const b = (item ?? {}) as Record<string, unknown>;
    const id = comoTexto(b.id, 40);
    if (!UUID.test(id)) return { erro: "Um dos botões veio sem identificação." };

    const label = comoTexto(b.label, 80);
    if (!label) return { erro: "Todo botão precisa de um texto." };

    let url = comoTexto(b.url, 800);
    if (!url) return { erro: `Falta o link do botão “${label}”.` };
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

    botoes.push({
      id,
      label,
      url,
      icon: comoTexto(b.icon, 8),
      destaque: b.destaque === true,
      active: b.active !== false,
      starts_at: comoInstante(b.starts_at),
      ends_at: comoInstante(b.ends_at),
    });
  }

  // `pixel_id` não entra aqui: mora no card da Meta, junto do token, e é salvo
  // por `salvarMeta`. Incluí-lo neste update apagaria o pixel toda vez que a
  // página fosse salva.
  const { error: erroPagina } = await supabase
    .from("link_pages")
    .update({
      title,
      bio: comoTexto(bruto.bio, 500) || null,
      avatar_url: comoTexto(bruto.avatar_url, 800) || null,
      active: bruto.active === true,
      theme: tema,
    })
    .eq("id", pageId);

  if (erroPagina) return { erro: "Não foi possível salvar a página." };

  if (botoes.length > 0) {
    const { error } = await supabase.from("link_buttons").upsert(
      botoes.map((b, i) => ({
        ...b,
        icon: b.icon || null,
        // O vínculo é do servidor: id de botão vem do navegador, e sem esta
        // linha um payload adulterado moveria botão de uma página para outra.
        page_id: pageId,
        position: i,
      })),
      { onConflict: "id" },
    );
    if (error) return { erro: "Não foi possível salvar os botões." };
  }

  // O que sumiu da lista sai do banco. Os cliques ficam: `link_clicks.button_id`
  // é `on delete set null` e o `rotulo` gravado no clique sustenta o relatório.
  let apagar = supabase.from("link_buttons").delete().eq("page_id", pageId);
  if (botoes.length > 0) {
    apagar = apagar.not("id", "in", `(${botoes.map((b) => b.id).join(",")})`);
  }
  await apagar;

  limparCachePublico(pagina.slug);
  // A lista de bios mostra título e se está no ar; o editor **não** é
  // revalidado de propósito — trocar as props por baixo derrubaria o estado.
  revalidatePath("/bio");

  return { ok: true, em: Date.now() };
}

/* -------------------------------------------------------------------------- */
/*  Meta — Pixel e Conversions API                                             */
/* -------------------------------------------------------------------------- */

/**
 * Os dois lados da Meta no mesmo lugar: o Pixel (que carrega no navegador) e o
 * token de CAPI (que faz o evento sair pelo servidor). Um sem o outro não
 * deduplica, então o formulário é um só.
 *
 * O token é gravado com a chave secreta e **nunca é lido de volta** para a tela
 * — o painel mostra apenas "configurado" ou "não configurado". Campo de token
 * vazio significa "não mexer", não "apagar": quem apaga é `removerToken`, senão
 * salvar só o Pixel derrubaria a CAPI sem querer.
 */
export async function salvarMeta(
  _anterior: ResultadoBio,
  formData: FormData,
): Promise<ResultadoBio> {
  const pageId = String(formData.get("page_id") ?? "");
  const { supabase, pagina } = await exigirPagina(pageId);

  const pixel = String(formData.get("pixel_id") ?? "").replace(/[^0-9]/g, "");
  const { error: erroPixel } = await supabase
    .from("link_pages")
    .update({ pixel_id: pixel || null })
    .eq("id", pageId);

  if (erroPixel) return { erro: "Não foi possível salvar o Pixel." };

  const token = String(formData.get("capi_token") ?? "").trim();
  if (token) {
    const { error } = await clienteSecreto()
      .from("link_secrets")
      .upsert({ page_id: pageId, capi_token: token }, { onConflict: "page_id" });
    if (error) return { erro: "Não foi possível salvar o token." };
  }

  limparCachePublico(pagina.slug);
  return { ok: true, em: Date.now() };
}

export async function removerToken(
  _anterior: ResultadoBio,
  formData: FormData,
): Promise<ResultadoBio> {
  const pageId = String(formData.get("page_id") ?? "");
  await exigirPagina(pageId);

  await clienteSecreto().from("link_secrets").delete().eq("page_id", pageId);
  return { ok: true, em: Date.now() };
}
