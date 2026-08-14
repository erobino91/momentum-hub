"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Painel de lives — ações da agência.
 *
 * O upload sobe pelo servidor, não pelo navegador: o bucket `materials` é
 * privado desde a Fase 6 (no projeto antigo era público, e o vídeo de qualquer
 * cliente abria por link direto). Quem transmite é o `lives-worker`, que enxerga
 * o banco com a chave secreta — daqui só sai a mensagem na fila.
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

const EXTENSOES = /\.(mp4|mov|m4v|webm|jpg|jpeg|png|webp)$/i;

export async function enviarMaterial(formData: FormData) {
  const supabase = await exigirAgencia();
  const orgId = String(formData.get("org_id") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const arquivo = formData.get("arquivo");

  if (!orgId) voltar("Empresa inválida.");
  if (!label) voltar("Dê um nome ao material.");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    voltar("Selecione um arquivo.");
  if (!EXTENSOES.test(arquivo.name))
    voltar("Formato não aceito. Use mp4, mov, webm ou imagem.");

  const ext = arquivo.name.slice(arquivo.name.lastIndexOf("."));
  // O caminho é o que fica guardado — não uma URL. Com bucket privado, a URL
  // só existe assinada e com validade, então guardá-la seria guardar lixo.
  const caminho = `${orgId}/raw/${Date.now()}${ext}`;

  const { error: erroUpload } = await supabase.storage
    .from("materials")
    .upload(caminho, arquivo, {
      cacheControl: "31536000", // nome único por timestamp: arquivo é imutável
      contentType: arquivo.type || undefined,
    });
  if (erroUpload) voltar(`Não foi possível enviar: ${erroUpload.message}`);

  // Entra como `processing`; o worker converte para o formato do Instagram e
  // marca `ready`.
  const { error } = await supabase.from("live_materials").insert({
    org_id: orgId,
    label,
    source_url: caminho,
    status: "processing",
  });
  if (error) voltar("Arquivo subiu, mas o material não foi registrado.");
  voltar();
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
