"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EXTENSOES } from "./limites";

/**
 * Painel de lives — ações da agência.
 *
 * **O arquivo não passa por aqui.** Até 03/09/26 passava: `enviarMaterial`
 * recebia o vídeo em `FormData`, e por isso nunca funcionou — o corpo de uma
 * server action é limitado a 1 MB pelo Next e a 4,5 MB pela Vercel, tetos que
 * nenhuma configuração levanta. Um material de 30 MB não cabia em nenhum dos
 * dois, e o painel só dizia "Enviando…" até desistir.
 *
 * O que sobrou para o servidor é o que ele faz bem: conferir que quem pede é a
 * agência, decidir o caminho e assinar uma permissão para aquele caminho só. Os
 * bytes vão do navegador direto para o Storage, o que também é o que expõe o
 * progresso real do envio (ver `enviar-material.tsx`).
 *
 * O bucket `materials` é privado desde a Fase 6 — no projeto antigo era público
 * e o vídeo de qualquer cliente abria por link direto. Quem transmite é o
 * `lives-worker`, que enxerga o banco com a chave secreta; daqui só sai a
 * mensagem na fila.
 */
async function exigirAgencia() {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");
  return supabase;
}

function voltar(erro?: string): never {
  revalidatePath("/agencia/lives");
  redirect(erro ? `/agencia/lives?erro=${encodeURIComponent(erro)}` : "/agencia/lives");
}

export type Assinatura =
  | { ok: true; caminho: string; token: string }
  | { ok: false; erro: string };

/**
 * Libera o navegador a escrever **um** caminho do bucket, e só ele.
 *
 * A policy `materials_agencia` já deixaria a sessão da agência escrever em
 * qualquer lugar do bucket; assinar aqui não é o que segura a porta, é o que
 * mantém a regra do nome do arquivo no servidor — do jeito que era quando o
 * arquivo ainda passava por ele.
 */
export async function criarUploadAssinado(
  orgId: string,
  nomeArquivo: string,
): Promise<Assinatura> {
  const supabase = await exigirAgencia();

  if (!orgId) return { ok: false, erro: "Empresa inválida." };
  if (!EXTENSOES.test(nomeArquivo))
    return { ok: false, erro: "Formato não aceito. Use mp4, mov, webm ou imagem." };

  const ext = nomeArquivo.slice(nomeArquivo.lastIndexOf("."));
  // O caminho é o que fica guardado — não uma URL. Com bucket privado, a URL
  // só existe assinada e com validade, então guardá-la seria guardar lixo.
  const caminho = `${orgId}/raw/${Date.now()}${ext}`;

  const { data, error } = await supabase.storage
    .from("materials")
    .createSignedUploadUrl(caminho);
  if (error || !data)
    return { ok: false, erro: `Não foi possível iniciar o envio: ${error?.message ?? ""}` };

  return { ok: true, caminho: data.path, token: data.token };
}

export type Registro = { ok: true } | { ok: false; erro: string };

/**
 * Segundo passo: o arquivo já está no bucket, agora vira linha.
 *
 * Se o navegador morrer entre o envio e esta chamada, sobra um arquivo em
 * `raw/` sem linha nenhuma. É inofensivo — sem registro, nem o painel nem o
 * worker enxergam o arquivo — e não vale um varredor por enquanto.
 */
export async function registrarMaterial(
  orgId: string,
  label: string,
  caminho: string,
): Promise<Registro> {
  const supabase = await exigirAgencia();

  if (!orgId || !caminho) return { ok: false, erro: "Envio inválido." };
  const nome = label.trim();
  if (!nome) return { ok: false, erro: "Dê um nome ao material." };

  // Entra como `processing`; o worker converte para o formato do Instagram,
  // vai escrevendo `progresso` e no fim marca `ready`.
  const { error } = await supabase.from("live_materials").insert({
    org_id: orgId,
    label: nome,
    source_url: caminho,
    status: "processing",
    progresso: 0,
  });
  if (error) return { ok: false, erro: "Arquivo subiu, mas o material não foi registrado." };

  revalidatePath("/agencia/lives");
  return { ok: true };
}

export async function apagarMaterial(formData: FormData) {
  const supabase = await exigirAgencia();
  const id = String(formData.get("id") ?? "");
  if (!id) voltar("Material inválido.");

  const { data: material } = await supabase
    .from("live_materials")
    .select("id,source_url,file_url")
    .eq("id", id)
    .maybeSingle<{ id: string; source_url: string; file_url: string | null }>();
  if (!material) voltar("Material não encontrado.");

  // Material em uso por live ativa não sai: o ffmpeg está lendo o arquivo.
  const { data: emUso } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("material_id", id)
    .in("status", ["starting", "live", "ending"])
    .maybeSingle<{ id: string }>();
  if (emUso) voltar("Material em uso por uma live ativa.");

  await supabase.from("live_materials").delete().eq("id", id);

  const caminhos = [material.source_url, material.file_url].filter(
    (c): c is string => typeof c === "string" && !c.startsWith("http"),
  );
  if (caminhos.length) {
    await supabase.storage.from("materials").remove(caminhos);
  }
  voltar();
}

export async function iniciarLive(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const materialId = String(formData.get("material_id") ?? "");
  const streamUrl = String(formData.get("stream_url") ?? "").trim();
  const streamKey = String(formData.get("stream_key") ?? "").trim();

  if (!orgId || !materialId) voltar("Escolha o material.");
  if (!streamUrl || !streamKey)
    voltar("Cole a URL e a chave do Live Producer.");
  // O Instagram entrega um edge RTMPS por transmissão; http aqui é erro de cola.
  if (!/^rtmps?:\/\//i.test(streamUrl))
    voltar("A URL do servidor deve começar com rtmps://");

  const { data: material } = await supabase
    .from("live_materials")
    .select("status")
    .eq("id", materialId)
    .maybeSingle<{ status: string }>();
  if (!material) voltar("Material não encontrado.");
  if (material.status !== "ready")
    voltar("O vídeo ainda está convertendo. Espere ficar pronto.");

  const { data: jaAtiva } = await supabase
    .from("live_sessions")
    .select("id")
    .eq("org_id", orgId)
    .in("status", ["starting", "live", "ending"])
    .maybeSingle<{ id: string }>();
  if (jaAtiva) voltar("Já existe uma live ativa para esta empresa.");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("live_sessions").insert({
    org_id: orgId,
    material_id: materialId,
    stream_url: streamUrl,
    stream_key: streamKey,
    status: "starting",
    created_by: user?.id ?? null,
  });
  if (error) voltar("Não foi possível iniciar a live.");
  voltar();
}

/**
 * Encerrar é pedir para encerrar: quem derruba o ffmpeg e escreve `ended` é o
 * worker. O painel nunca marca `ended` sozinho — se marcasse, uma transmissão
 * continuaria no ar com o banco dizendo que acabou.
 */
export async function encerrarLive(formData: FormData) {
  const supabase = await exigirAgencia();
  const id = String(formData.get("id") ?? "");
  if (!id) voltar("Live inválida.");

  const { error } = await supabase
    .from("live_sessions")
    .update({ status: "ending" })
    .eq("id", id)
    .in("status", ["starting", "live"]);
  if (error) voltar("Não foi possível encerrar.");
  voltar();
}
