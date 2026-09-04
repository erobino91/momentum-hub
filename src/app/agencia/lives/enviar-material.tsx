"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Aviso,
  Botao,
  Campo,
  Entrada,
  Progresso,
  Rodinha,
  campoEstilo,
  formatarMB,
} from "@/components/ui";
import { criarUploadAssinado, registrarMaterial } from "./actions";
import { TAMANHO_MAXIMO } from "./limites";

/**
 * Envio de material — os bytes saem daqui direto para o Storage.
 *
 * **Por que não é um `<form action={serverAction}>`.** Era, e não funcionava: o
 * corpo de uma server action para em 1 MB no Next e em 4,5 MB na Vercel, e
 * vídeo nenhum cabe nisso. Passando direto do navegador para o Storage o limite
 * volta a ser só o do bucket — e, de quebra, o `XMLHttpRequest` entrega
 * `upload.onprogress`, que é a única forma de saber quantos bytes já foram. O
 * `supabase-js` sobe por `fetch`, e `fetch` não reporta progresso de upload;
 * por isso o XHR na mão em vez de `uploadToSignedUrl`.
 *
 * Consequência: `BotaoEnviar` não serve aqui. Ele lê `useFormStatus`, que só
 * enxerga formulário com server action no `action` — sem isso, ele nunca sairia
 * do estado parado. O estado de envio é local.
 */
export function EnviarMaterial({ orgId }: { orgId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [label, setLabel] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviados, setEnviados] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = arquivo?.size ?? 0;
  const pct = enviados == null || !total ? null : (enviados / total) * 100;

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);

    if (!arquivo) return setErro("Selecione um arquivo.");
    if (!label.trim()) return setErro("Dê um nome ao material.");
    // Conferido antes de começar: descobrir o limite depois de esperar a barra
    // encher é a pior hora de descobrir.
    if (arquivo.size > TAMANHO_MAXIMO)
      return setErro(
        `O arquivo tem ${formatarMB(arquivo.size)} e o limite é ${formatarMB(
          TAMANHO_MAXIMO,
        )}. Comprima o vídeo antes de subir.`,
      );

    setEnviando(true);
    setEnviados(0);
    try {
      const assinatura = await criarUploadAssinado(orgId, arquivo.name);
      if (!assinatura.ok) throw new Error(assinatura.erro);

      await enviarBytes(assinatura.caminho, assinatura.token, arquivo, setEnviados);

      const registro = await registrarMaterial(orgId, label, assinatura.caminho);
      if (!registro.ok) throw new Error(registro.erro);

      formRef.current?.reset();
      setLabel("");
      setArquivo(null);
      setEnviados(null);
      // `revalidatePath` na action marca o cache, mas quem não veio de um
      // `action={}` não re-renderiza sozinho.
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar.");
      setEnviados(null);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={enviar}
      className="space-y-3 border-t border-line pt-4"
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <Campo rotulo="Nome" obrigatorio>
        <Entrada
          name="label"
          required
          disabled={enviando}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex.: promoção de terça"
        />
      </Campo>

      <Campo
        rotulo="Arquivo"
        obrigatorio
        ajuda={`Vídeo ou imagem, até ${formatarMB(TAMANHO_MAXIMO)}.`}
      >
        <input
          name="arquivo"
          type="file"
          required
          disabled={enviando}
          accept="video/*,image/*"
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setErro(null);
          }}
          // Input de arquivo não é campo de texto: vestir os dois iguais
          // deixava um botão do sistema dentro de uma caixa de digitar.
          className={`${campoEstilo} cursor-pointer py-2 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-3 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground`}
        />
      </Campo>

      {enviados != null ? (
        <Progresso
          valor={pct}
          tom="marca"
          rotulo={arquivo?.name}
          detalhe={`${formatarMB(enviados)} de ${formatarMB(total)}`}
        />
      ) : null}

      <div className="flex justify-end pt-1">
        <Botao type="submit" disabled={enviando} aria-busy={enviando || undefined}>
          {enviando ? (
            <>
              <Rodinha />
              Enviando…
            </>
          ) : (
            "Enviar material"
          )}
        </Botao>
      </div>
    </form>
  );
}

/**
 * O PUT para a URL assinada, com progresso.
 *
 * É o mesmo endpoint que `uploadToSignedUrl` usa por baixo — a diferença é o
 * XHR, que avisa a cada pedaço enviado.
 */
function enviarBytes(
  caminho: string,
  token: string,
  arquivo: File,
  aoAndar: (bytes: number) => void,
) {
  // Cada segmento vai codificado, mas as barras continuam sendo barras.
  const alvo = caminho.split("/").map(encodeURIComponent).join("/");
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/upload/sign/materials/${alvo}?token=${token}`;

  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url, true);
    xhr.setRequestHeader(
      "Content-Type",
      arquivo.type || "application/octet-stream",
    );
    // Nome único por timestamp: o arquivo é imutável, pode ficar em cache.
    xhr.setRequestHeader("Cache-Control", "31536000");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) aoAndar(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        aoAndar(arquivo.size);
        resolve();
      } else {
        reject(new Error(mensagemDoErro(xhr)));
      }
    };
    xhr.onerror = () =>
      reject(new Error("A conexão caiu durante o envio. Tente de novo."));
    xhr.onabort = () => reject(new Error("Envio cancelado."));
    xhr.send(arquivo);
  });
}

function mensagemDoErro(xhr: XMLHttpRequest): string {
  // O Storage responde erro em JSON; se não vier, o status já diz algo.
  try {
    const corpo = JSON.parse(xhr.responseText) as { message?: string };
    if (corpo.message) return `Não foi possível enviar: ${corpo.message}`;
  } catch {}
  if (xhr.status === 413)
    return "O arquivo passou do limite aceito pelo Storage.";
  return `Não foi possível enviar (erro ${xhr.status}).`;
}
