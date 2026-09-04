import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LiveMaterial, LiveSession, Org } from "@/types/db";
import { AtualizacaoAutomatica, Cronometro } from "./atualizacao-automatica";
import { apagarMaterial, iniciarLive, encerrarLive } from "./actions";
import { EnviarMaterial } from "./enviar-material";
import { AgenciaShell } from "@/components/shell";
import {
  Aviso,
  Botao,
  BotaoEnviar,
  Campo,
  CampoInstante,
  ConfirmarAcao,
  Dialogo,
  Entrada,
  Progresso,
  Selecao,
  Selo,
  Vazio,
} from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lives" };

const ROTULO_STATUS: Record<LiveSession["status"], string> = {
  starting: "iniciando",
  live: "no ar",
  ending: "encerrando",
  ended: "encerrada",
  error: "erro",
  scheduled: "agendada",
  missed: "não aconteceu",
  canceled: "cancelada",
};

/**
 * A tela é renderizada no servidor, e na Vercel o servidor é UTC — sem fixar o
 * fuso, o "corte automático às 21h" apareceria como 18h para quem está aqui.
 */
const FUSO = "America/Sao_Paulo";

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Dois `timestamptz` que valem o mesmo instante. Comparar as strings cruas não
 * serve: `+00:00` e `.000Z` são o mesmo momento escrito de dois jeitos, e quem
 * escreve cada uma das colunas é um processo diferente.
 */
const mesmoInstante = (a: string | null, b: string | null) =>
  Boolean(a && b && new Date(a).getTime() === new Date(b).getTime());

/** Com o dia junto, porque agendada pode ser para amanhã. */
const dataEHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Painel de lives — todas as empresas em uma tela só, como era o `lives.html`.
 *
 * `stream_key` **não é selecionada aqui**. É a chave da transmissão do
 * Instagram do cliente e quem precisa dela é o worker, que lê o banco com a
 * chave secreta. A tela mostra o estado; o segredo entra pelo formulário e não
 * volta — e, desde a Fase 8, entra dentro de um diálogo em vez de ficar num
 * campo aberto no meio da página, ao lado do seletor de arquivo.
 *
 * Quem está no ar vem primeiro: com dez empresas listadas em ordem alfabética,
 * a que está transmitindo podia estar no fim da rolagem.
 */
export default async function LivesPage({
  searchParams,
}: {
  searchParams: { erro?: string };
}) {
  const supabase = createClient();
  const { data: ehAgencia } = await supabase.rpc("is_agency");
  if (!ehAgencia) redirect("/");

  const [{ data: orgs }, { data: materiais }, { data: sessoes }] =
    await Promise.all([
      supabase.from("orgs").select("id,name,slug").order("name").returns<Org[]>(),
      supabase
        .from("live_materials")
        .select("*")
        .order("created_at", { ascending: false })
        .returns<LiveMaterial[]>(),
      supabase
        .from("live_sessions")
        .select(
          "id,org_id,material_id,stream_url,status,started_at,ended_at,auto_cutoff_at,error_message,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100)
        .returns<LiveSession[]>(),
    ]);

  const ativas = (sessoes ?? []).filter((s) =>
    ["starting", "live", "ending"].includes(s.status),
  );
  // Agendada não é "ativa": não há ffmpeg, não há cronômetro e o botão dela
  // cancela em vez de encerrar. Mas ocupa a empresa, então o card não pode
  // oferecer "Entrar no ar" por cima dela.
  const agendadas = (sessoes ?? []).filter((s) => s.status === "scheduled");
  // Converter também merece atualização automática: sem isto a barra de
  // conversão só andaria se alguém ficasse apertando F5.
  const convertendo = (materiais ?? []).some((m) => m.status === "processing");
  const materiaisDe = (orgId: string) =>
    (materiais ?? []).filter((m) => m.org_id === orgId);
  const ativaDe = (orgId: string) => ativas.find((s) => s.org_id === orgId);
  const agendadaDe = (orgId: string) =>
    agendadas.find((s) => s.org_id === orgId);

  const lista = [...(orgs ?? [])].sort((a, b) => {
    const noAr = Number(Boolean(ativaDe(b.id))) - Number(Boolean(ativaDe(a.id)));
    if (noAr) return noAr;
    // Depois de quem está no ar vem quem tem hora marcada — é o próximo card
    // que vai pedir atenção.
    const marcada =
      Number(Boolean(agendadaDe(b.id))) - Number(Boolean(agendadaDe(a.id)));
    if (marcada) return marcada;
    // Depois de quem está no ar, quem tem material vem antes de quem não tem.
    const comMaterial =
      Number(materiaisDe(b.id).length > 0) - Number(materiaisDe(a.id).length > 0);
    return comMaterial || a.name.localeCompare(b.name);
  });

  return (
    <AgenciaShell
      secao="lives"
      migalha={[{ rotulo: "Lives" }]}
      titulo={
        ativas.length
          ? `${ativas.length} ${ativas.length === 1 ? "live no ar" : "lives no ar"}`
          : "Lives"
      }
      selo={ativas.length ? <Selo tom="erro">ao vivo</Selo> : undefined}
      acoes={
        <AtualizacaoAutomatica
          ativa={ativas.length > 0 || agendadas.length > 0 || convertendo}
        />
      }
    >
      <p className="-mt-1 mb-5 max-w-2xl text-sm text-muted">
        Vídeo em loop para o Instagram Live. Quem transmite é o worker na máquina
        ligada — esta tela só manda o recado.
      </p>

      {searchParams.erro ? (
        <div className="mb-5">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      <div className="space-y-3">
        {lista.map((org) => {
          const materiaisOrg = materiaisDe(org.id);
          const ativa = ativaDe(org.id);
          const agendada = agendadaDe(org.id);
          const prontos = materiaisOrg.filter((m) => m.status === "ready");
          const sessao = ativa ?? agendada;
          const material = materiaisOrg.find((m) => m.id === sessao?.material_id);

          return (
            <section
              key={org.id}
              className={`rounded-lg border bg-surface-1 p-5 ${
                ativa ? "border-danger/40" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold">{org.name}</h2>
                  {ativa ? (
                    <p className="mt-1 text-sm text-muted">
                      {material?.label ?? "material removido"}
                      {ativa.auto_cutoff_at ? (
                        <>
                          {/* Só é "termina às" se o horário pedido tiver
                              sobrevivido ao teto de 3h50; se o teto venceu, quem
                              corta é o automático, e dizer outra coisa seria a
                              tela prometer um horário que não vai acontecer. */}
                          {mesmoInstante(ativa.encerrar_em, ativa.auto_cutoff_at)
                            ? " · termina às "
                            : " · corte automático às "}
                          {hora(ativa.auto_cutoff_at)}
                        </>
                      ) : null}
                    </p>
                  ) : agendada ? (
                    <p className="mt-1 text-sm text-muted">
                      {material?.label ?? "material removido"}
                      {agendada.iniciar_em ? (
                        <> · começa {dataEHora(agendada.iniciar_em)}</>
                      ) : null}
                      {agendada.encerrar_em ? (
                        <> · até {hora(agendada.encerrar_em)}</>
                      ) : null}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-dim">
                      {prontos.length
                        ? `${prontos.length} ${prontos.length === 1 ? "material pronto" : "materiais prontos"}`
                        : "nenhum material pronto"}
                    </p>
                  )}
                  {sessao?.error_message ? (
                    <p className="mt-1.5 text-xs text-danger">
                      {sessao.error_message}
                    </p>
                  ) : null}
                  {agendada ? (
                    <p className="mt-1.5 text-xs text-dim">
                      O worker precisa estar rodando na hora marcada — senão a
                      live não acontece.
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {ativa ? (
                    <>
                      <Selo tom="erro">
                        {ROTULO_STATUS[ativa.status]}
                        {ativa.started_at ? (
                          <>
                            {" · "}
                            <Cronometro desde={ativa.started_at} />
                          </>
                        ) : null}
                      </Selo>
                      <ConfirmarAcao
                        acao={encerrarLive}
                        rotulo="Encerrar"
                        titulo={`Encerrar a live de ${org.name}?`}
                        descricao="A transmissão no Instagram cai na hora."
                        confirmar="Encerrar live"
                      >
                        <input type="hidden" name="id" value={ativa.id} />
                      </ConfirmarAcao>
                    </>
                  ) : agendada ? (
                    <>
                      <Selo tom="atencao">
                        {ROTULO_STATUS[agendada.status]}
                      </Selo>
                      <ConfirmarAcao
                        acao={encerrarLive}
                        rotulo="Cancelar"
                        titulo={`Cancelar a live agendada de ${org.name}?`}
                        descricao="Ela não vai subir no horário marcado. Nada está no ar ainda."
                        confirmar="Cancelar agendamento"
                      >
                        <input type="hidden" name="id" value={agendada.id} />
                      </ConfirmarAcao>
                    </>
                  ) : (
                    <DialogoEntrarNoAr
                      org={org}
                      prontos={prontos.map((m) => ({ id: m.id, label: m.label }))}
                    />
                  )}
                  <DialogoMateriais
                    org={org}
                    materiais={materiaisOrg.map((m) => ({
                      id: m.id,
                      label: m.label,
                      status: m.status,
                      progresso: m.progresso,
                      progresso_em: m.progresso_em,
                    }))}
                  />
                </div>
              </div>
            </section>
          );
        })}

        {lista.length === 0 ? (
          <Vazio titulo="Nenhuma empresa cadastrada" />
        ) : null}
      </div>
    </AgenciaShell>
  );
}

/**
 * Entrar no ar. Servidor e chave ficam aqui dentro: eram dois campos abertos no
 * meio da página, um deles com o segredo da transmissão do cliente à mostra
 * para quem passasse pela mesa.
 */
function DialogoEntrarNoAr({
  org,
  prontos,
}: {
  org: Pick<Org, "id" | "name">;
  prontos: { id: string; label: string }[];
}) {
  if (!prontos.length) {
    return (
      <Botao variante="secundario" tamanho="sm" disabled>
        Entrar no ar
      </Botao>
    );
  }

  return (
    <Dialogo
      rotulo="Entrar no ar"
      variante="primario"
      tamanho="sm"
      titulo={`Entrar no ar — ${org.name}`}
      descricao="Servidor e chave saem do Live Producer do Instagram. A chave é gravada para o worker e não volta para esta tela. Com hora marcada, a live fica engatilhada — mas quem publica no Instagram continua sendo você, clicando em Go live quando a prévia aparecer."
    >
      <form action={iniciarLive} className="space-y-3">
        <input type="hidden" name="org_id" value={org.id} />
        <Campo rotulo="Material" obrigatorio>
          <Selecao name="material_id" required>
            {prontos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Selecao>
        </Campo>
        <Campo rotulo="Servidor RTMPS" obrigatorio>
          <Entrada
            name="stream_url"
            required
            placeholder="rtmps://…"
            autoComplete="off"
          />
        </Campo>
        <Campo rotulo="Chave da transmissão" obrigatorio>
          <Entrada name="stream_key" type="password" required autoComplete="off" />
        </Campo>

        <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-2">
          <Campo rotulo="Começar às" ajuda="Em branco, começa agora.">
            <CampoInstante name="iniciar_em" />
          </Campo>
          <Campo rotulo="Terminar às" ajuda="Em branco, corta em 3h50.">
            <CampoInstante name="encerrar_em" />
          </Campo>
        </div>

        <div className="flex justify-end pt-1">
          <BotaoEnviar pendente="Subindo…">Entrar no ar</BotaoEnviar>
        </div>
      </form>
    </Dialogo>
  );
}

/**
 * Quanto tempo faz que o worker deu sinal — e só fala quando já é notícia.
 *
 * Uma barra parada em 12% é idêntica ao worker morto e à conversão lenta. Foi o
 * caso de 03/09: a janela do worker congelou (o QuickEdit do console do Windows
 * pausa o processo ao clicar dentro) e o material ficaria "convertendo" a noite
 * toda sem uma linha explicando.
 */
function semSinalHa(quando: string | null): string | undefined {
  if (!quando) return undefined;
  const seg = Math.floor((Date.now() - new Date(quando).getTime()) / 1000);
  if (seg < 60) return undefined;
  const min = Math.floor(seg / 60);
  return `sem sinal do worker há ${min} min — ele está rodando?`;
}

/** Materiais da empresa: lista, remoção e envio, em um lugar só. */
function DialogoMateriais({
  org,
  materiais,
}: {
  org: Pick<Org, "id" | "name">;
  materiais: {
    id: string;
    label: string;
    status: LiveMaterial["status"];
    progresso: number | null;
    progresso_em: string | null;
  }[];
}) {
  return (
    <Dialogo
      rotulo={`Materiais (${materiais.length})`}
      variante="secundario"
      tamanho="sm"
      titulo={`Materiais — ${org.name}`}
      // Subir vídeo demora; fechar ao enviar levaria embora justamente a barra
      // de progresso, e pareceria que nada aconteceu.
      fecharAoEnviar={false}
    >
      {materiais.length ? (
        <ul className="mb-4 space-y-1.5">
          {materiais.map((m) => (
            <li key={m.id} className="rounded-md bg-surface-3 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {m.label}
                </span>
                <Selo
                  tom={
                    m.status === "ready"
                      ? "pronto"
                      : m.status === "error"
                        ? "erro"
                        : "atencao"
                  }
                >
                  {m.status === "ready"
                    ? "pronto"
                    : m.status === "error"
                      ? "falhou"
                      : "convertendo"}
                </Selo>
                <ConfirmarAcao
                  acao={apagarMaterial}
                  rotulo="Remover"
                  titulo={`Remover ${m.label}?`}
                  descricao="O arquivo sai do armazenamento. Uma live que esteja usando este material não é interrompida."
                  confirmar="Remover material"
                >
                  <input type="hidden" name="id" value={m.id} />
                </ConfirmarAcao>
              </div>

              {m.status === "processing" ? (
                <div className="mt-2.5">
                  <Progresso
                    valor={m.progresso}
                    tom="atencao"
                    rotulo="Convertendo para o formato do Instagram"
                    detalhe={semSinalHa(m.progresso_em)}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-dim">Nenhum material enviado.</p>
      )}

      <EnviarMaterial orgId={org.id} />
    </Dialogo>
  );
}
