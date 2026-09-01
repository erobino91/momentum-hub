"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState } from "react-dom";
import { BioRender } from "@/components/bio-render";
import {
  AcoesDialogo,
  AreaTexto,
  Aviso,
  Botao,
  BotaoEnviar,
  Campo,
  Cartao,
  Dialogo,
  Entrada,
  Selecao,
  opcaoEstilo,
} from "@/components/ui";
import { NICHOS, NICHOS_LISTA, nichoDe, paletaDoNicho } from "@/lib/bio/nichos";
import { URL_BIO } from "@/lib/bio/url";
import { removerToken, salvarBio, salvarMeta } from "../actions";
import {
  botaoNoAr,
  temaCompleto,
  type LinkButton,
  type LinkPage,
  type NichoBio,
  type TemaBio,
} from "@/types/bio";

/**
 * O construtor da bio.
 *
 * A tela inteira é **um** modelo no navegador: página + lista de botões. O
 * preview lê esse modelo, então tudo aparece na hora — inclusive rótulo, ícone,
 * ordem e destaque dos botões, que antes só surgiam depois de salvar. Nada aqui
 * navega enquanto se edita, e é essa a correção de fundo: quando cada cartão
 * tinha o próprio formulário com `redirect`, salvar um derrubava o que estava
 * aberto nos outros — escolher o nicho e adicionar um botão em seguida devolvia
 * a página ao visual padrão.
 *
 * Gravar é um passo só, explícito, no fim. Botão criado ou removido também
 * espera o Salvar: enquanto não se clica, dá para desistir.
 */

type BotaoLocal = {
  id: string;
  label: string;
  url: string;
  icon: string;
  destaque: boolean;
  active: boolean;
  /** Formato do `datetime-local`; vazio = sem janela. */
  starts_at: string;
  ends_at: string;
};

/** `datetime-local` não aceita ISO com fuso; corta no minuto, em hora local. */
function paraInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Botão novo precisa de id **antes** de existir linha: é ele que identifica o
 * item no preview, na reordenação e depois no `upsert`. O ramo manual existe
 * porque `crypto.randomUUID` só é exposto em contexto seguro — em `http://` de
 * rede local ele simplesmente não está lá.
 */
function novoUuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function EditorBio({
  pagina,
  botoes,
  temToken,
}: {
  pagina: LinkPage;
  botoes: LinkButton[];
  temToken: boolean;
}) {
  const tema = temaCompleto(pagina.theme);

  const [titulo, setTitulo] = useState(pagina.title);
  const [bio, setBio] = useState(pagina.bio ?? "");
  const [avatar, setAvatar] = useState(pagina.avatar_url ?? "");
  const [noAr, setNoAr] = useState(pagina.active);
  const [cores, setCores] = useState<Required<TemaBio>>(tema);
  const [nicho, setNicho] = useState<NichoBio>(nichoDe(tema.nicho));
  // O degradê é opcional: sem isto, `input[type=color]` sem valor viraria preto
  // e toda página passaria a ter um gradiente que ninguém pediu.
  const [gradiente, setGradiente] = useState(Boolean(tema.fundo2));

  const [lista, setLista] = useState<BotaoLocal[]>(() =>
    botoes.map((b) => ({
      id: b.id,
      label: b.label,
      url: b.url,
      icon: b.icon ?? "",
      destaque: b.destaque,
      active: b.active,
      starts_at: paraInput(b.starts_at),
      ends_at: paraInput(b.ends_at),
    })),
  );
  const [arrastando, setArrastando] = useState<string | null>(null);
  const campoUrl = useRef<Record<string, HTMLInputElement | null>>({});

  /** A página nunca foi salva: nenhuma cor foi escolhida ainda. */
  const semTema = Object.keys(pagina.theme ?? {}).length === 0;

  const [resultado, salvar] = useFormState(salvarBio, null);

  const dados = JSON.stringify({
    title: titulo,
    bio,
    avatar_url: avatar,
    active: noAr,
    theme: { ...cores, nicho, fundo2: gradiente ? cores.fundo2 : "" },
    botoes: lista.map((b) => ({
      ...b,
      starts_at: b.starts_at || null,
      ends_at: b.ends_at || null,
    })),
  });

  const [salvo, setSalvo] = useState(dados);
  const sujo = dados !== salvo;

  // O que foi gravado vira a nova referência de "limpo". Fica num ref porque o
  // efeito depende do resultado da action, não de cada tecla digitada.
  const dadosRef = useRef(dados);
  dadosRef.current = dados;
  useEffect(() => {
    if (resultado && "ok" in resultado) setSalvo(dadosRef.current);
  }, [resultado]);

  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sujo]);

  function mudarBotao(id: string, campo: Partial<BotaoLocal>) {
    setLista((atual) => atual.map((b) => (b.id === id ? { ...b, ...campo } : b)));
  }

  function adicionar(icon = "", label = "") {
    const id = novoUuid();
    setLista((atual) => [
      ...atual,
      {
        id,
        label,
        url: "",
        icon,
        destaque: false,
        active: true,
        starts_at: "",
        ends_at: "",
      },
    ]);
    // O que falta é o link: o foco vai direto para lá assim que a linha existe.
    window.setTimeout(() => campoUrl.current[id]?.focus(), 0);
  }

  function soltar(alvoId: string) {
    if (!arrastando || arrastando === alvoId) return;
    setLista((atual) => {
      const nova = [...atual];
      const de = nova.findIndex((b) => b.id === arrastando);
      const para = nova.findIndex((b) => b.id === alvoId);
      if (de < 0 || para < 0) return atual;
      nova.splice(para, 0, nova.splice(de, 1)[0]);
      return nova;
    });
    setArrastando(null);
  }

  function aplicarPaleta(qual: NichoBio = nicho) {
    const paleta = paletaDoNicho(qual);
    setCores(paleta);
    setGradiente(Boolean(paleta.fundo2));
  }

  function trocarNicho(valor: string) {
    const novo = nichoDe(valor);
    setNicho(novo);
    // Página que nunca foi salva não tem cor para preservar — escolher o nicho e
    // a tela não mudar nada é exatamente a confusão que isto evita.
    if (semTema) aplicarPaleta(novo);
  }

  const noArAgora = (b: BotaoLocal) =>
    botaoNoAr({
      active: b.active,
      starts_at: b.starts_at || null,
      ends_at: b.ends_at || null,
    });

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Bio</p>
          <h1 className="mt-2 truncate text-3xl font-semibold">{titulo}</h1>
          <p className="mt-1 text-sm text-muted">
            {URL_BIO}/{pagina.slug}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
          <Link href={`/bio/${pagina.id}/relatorio`} className="hover:text-foreground">
            Relatório de cliques
          </Link>
          <a
            href={`/b/${pagina.slug}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            Abrir página
          </a>
          <Link href="/bio" className="hover:text-foreground">
            Voltar
          </Link>
        </div>
      </header>

      <form action={salvar}>
        <input type="hidden" name="page_id" value={pagina.id} />
        <input type="hidden" name="dados" value={dados} />

        {/* A barra acompanha a rolagem: com o preview alto, o Salvar ficava
            fora da tela justo quando havia mais coisa para salvar. */}
        <div className="sticky top-0 z-20 -mx-6 mt-8 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas/95 px-6 py-3 backdrop-blur">
          <p className="text-sm text-muted">
            {sujo ? (
              <>
                <span aria-hidden className="mr-2 text-warn">
                  ●
                </span>
                Alterações não salvas
              </>
            ) : (
              "Tudo salvo"
            )}
          </p>
          <BotaoEnviar pendente="Salvando…" disabled={!sujo}>
            Salvar alterações
          </BotaoEnviar>
        </div>

        {resultado && "erro" in resultado ? (
          <div className="mt-4">
            <Aviso>{resultado.erro}</Aviso>
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* ------------------------------------------------------ página */}
            <Cartao titulo="Página">
              <div className="space-y-4">
                <Campo rotulo="Título" obrigatorio>
                  <Entrada value={titulo} onChange={(e) => setTitulo(e.target.value)} />
                </Campo>

                <Campo rotulo="Descrição">
                  <AreaTexto rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
                </Campo>

                <Campo rotulo="Foto (URL)">
                  <Entrada
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://..."
                  />
                </Campo>

                {/* O nicho escolhe o visual da página pública: layout de
                    vitrine, textura de fundo e forma dos cartões. */}
                <Campo rotulo="Nicho" ajuda={NICHOS[nicho].descricao}>
                  <div className="flex flex-wrap items-center gap-3">
                    <Selecao
                      value={nicho}
                      onChange={(e) => trocarNicho(e.target.value)}
                      className="sm:w-64"
                    >
                      {NICHOS_LISTA.map((n) => (
                        <option key={n} value={n} className={opcaoEstilo}>
                          {NICHOS[n].nome}
                        </option>
                      ))}
                    </Selecao>
                    <Botao variante="fantasma" onClick={() => aplicarPaleta()}>
                      Aplicar cores do nicho
                    </Botao>
                  </div>
                </Campo>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {(
                    [
                      ["Fundo", "fundo"],
                      ["Texto", "texto"],
                      ["Botão", "botao"],
                      ["Texto do botão", "botaoTexto"],
                    ] as const
                  ).map(([nome, chave]) => (
                    <Campo key={chave} rotulo={nome}>
                      <input
                        type="color"
                        value={cores[chave]}
                        onChange={(e) => setCores({ ...cores, [chave]: e.target.value })}
                        className="h-10 w-full cursor-pointer rounded-md border border-line-strong bg-surface-1"
                      />
                    </Campo>
                  ))}

                  {nicho === "classico" ? null : (
                    <Campo rotulo="Destaque">
                      <input
                        type="color"
                        value={cores.destaque}
                        onChange={(e) => setCores({ ...cores, destaque: e.target.value })}
                        className="h-10 w-full cursor-pointer rounded-md border border-line-strong bg-surface-1"
                      />
                    </Campo>
                  )}

                  <Campo rotulo="Fundo 2">
                    <input
                      type="color"
                      disabled={!gradiente}
                      value={cores.fundo2 || cores.fundo}
                      onChange={(e) => setCores({ ...cores, fundo2: e.target.value })}
                      className="h-10 w-full cursor-pointer rounded-md border border-line-strong bg-surface-1 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </Campo>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={gradiente}
                    onChange={(e) => {
                      setGradiente(e.target.checked);
                      if (e.target.checked && !cores.fundo2) {
                        setCores({ ...cores, fundo2: cores.fundo });
                      }
                    }}
                    className="h-4 w-4 accent-brand"
                  />
                  Fundo em degradê (do Fundo até o Fundo 2)
                </label>

                {/* Este interruptor é o que publica. Enquanto estiver desligado
                    o endereço público devolve 404, e o card de Bio no portal do
                    cliente aparece como "em configuração". */}
                <label className="flex items-start gap-2.5 rounded-md border border-line bg-surface-2 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={noAr}
                    onChange={(e) => setNoAr(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-brand"
                  />
                  <span>
                    <span className="font-medium">Página no ar</span>
                    <span className="mt-0.5 block text-xs text-dim">
                      Desligada, o endereço devolve 404 e o cliente vê o módulo
                      como “em configuração”.
                    </span>
                  </span>
                </label>
              </div>
            </Cartao>

            {/* ------------------------------------------------------ botões */}
            <Cartao
              titulo="Botões"
              descricao="Arraste pela alça ⠿ para mudar a ordem. Tudo aqui aparece no preview na hora."
            >
              <div className="space-y-3">
                {lista.map((b) => (
                  <div
                    key={b.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => soltar(b.id)}
                    className={`rounded-lg border p-4 transition ${
                      arrastando === b.id
                        ? "border-brand bg-brand/10"
                        : "border-line bg-surface-1"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        draggable
                        onDragStart={() => setArrastando(b.id)}
                        onDragEnd={() => setArrastando(null)}
                        className="cursor-grab select-none pt-2 text-lg text-muted active:cursor-grabbing"
                        aria-label={`Mover ${b.label}`}
                      >
                        ⠿
                      </span>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex flex-wrap gap-3">
                          {/* A largura vai no invólucro: `w-16` no próprio campo
                              perde para o `w-full` de `campoEstilo` — entre duas
                              utilitárias de largura ganha a que o Tailwind emite
                              depois, e `w-full` vem depois de `w-16`. */}
                          <div className="w-16 shrink-0">
                            <Entrada
                              value={b.icon}
                              onChange={(e) => mudarBotao(b.id, { icon: e.target.value })}
                              placeholder="🍔"
                              aria-label="Ícone"
                              className="text-center"
                            />
                          </div>
                          <Entrada
                            value={b.label}
                            onChange={(e) => mudarBotao(b.id, { label: e.target.value })}
                            placeholder="Texto do botão"
                            aria-label="Texto do botão"
                            className="min-w-[10rem] flex-1"
                          />
                        </div>

                        <Entrada
                          ref={(el) => {
                            campoUrl.current[b.id] = el;
                          }}
                          value={b.url}
                          onChange={(e) => mudarBotao(b.id, { url: e.target.value })}
                          placeholder="https://..."
                          aria-label="Link de destino"
                          invalido={!b.url}
                        />

                        <details className="text-sm text-muted">
                          <summary className="cursor-pointer">Agendamento</summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <Campo rotulo="Começa em">
                              <Entrada
                                type="datetime-local"
                                value={b.starts_at}
                                onChange={(e) => mudarBotao(b.id, { starts_at: e.target.value })}
                              />
                            </Campo>
                            <Campo rotulo="Termina em">
                              <Entrada
                                type="datetime-local"
                                value={b.ends_at}
                                onChange={(e) => mudarBotao(b.id, { ends_at: e.target.value })}
                              />
                            </Campo>
                          </div>
                        </details>

                        <div className="flex flex-wrap items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={b.active}
                              onChange={(e) => mudarBotao(b.id, { active: e.target.checked })}
                              className="h-4 w-4 accent-brand"
                            />
                            Ativo
                          </label>
                          <label
                            className="flex items-center gap-2 text-sm"
                            title="Vira o cartão cheio da cor de destaque na página"
                          >
                            <input
                              type="checkbox"
                              checked={b.destaque}
                              onChange={(e) => mudarBotao(b.id, { destaque: e.target.checked })}
                              className="h-4 w-4 accent-brand"
                            />
                            Destaque
                          </label>

                          <Dialogo
                            rotulo="Remover"
                            variante="destrutivo"
                            tamanho="sm"
                            titulo={`Remover “${b.label || "botão"}”?`}
                            descricao="Sai da lista agora e do banco quando você salvar. Os cliques já registrados continuam no relatório."
                          >
                            <AcoesDialogo>
                              <Botao
                                variante="fantasma"
                                onClick={(e) => e.currentTarget.closest("dialog")?.close()}
                              >
                                Cancelar
                              </Botao>
                              <Botao
                                variante="perigo"
                                onClick={(e) => {
                                  e.currentTarget.closest("dialog")?.close();
                                  setLista((atual) => atual.filter((x) => x.id !== b.id));
                                }}
                              >
                                Remover
                              </Botao>
                            </AcoesDialogo>
                          </Dialogo>

                          {noArAgora(b) ? null : (
                            <span className="text-xs text-muted">fora do ar agora</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-line pt-5">
                {/* As sugestões só montam a linha. Criar o botão com uma URL de
                    mentira publicaria link quebrado. */}
                {NICHOS[nicho].sugestoes.length > 0 ? (
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">Sugestões do nicho:</span>
                    {NICHOS[nicho].sugestoes.map((sg) => (
                      <button
                        key={sg.label}
                        type="button"
                        onClick={() => adicionar(sg.icon, sg.label)}
                        className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm transition hover:border-line-strong hover:text-foreground"
                      >
                        <span aria-hidden>{sg.icon}</span> {sg.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <Botao variante="secundario" onClick={() => adicionar()}>
                  + Adicionar botão
                </Botao>
              </div>
            </Cartao>
          </div>

          {/* ------------------------------------------------------ preview */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
              Preview
            </p>
            <div className="overflow-hidden rounded-[2rem] border-4 border-line-strong">
              <div className="max-h-[70vh] overflow-y-auto">
                <BioRender
                  modo="preview"
                  pagina={{
                    slug: pagina.slug,
                    title: titulo,
                    bio: bio || null,
                    avatarUrl: avatar || null,
                    tema: { ...cores, nicho, fundo2: gradiente ? cores.fundo2 : "" },
                    pixelId: pagina.pixel_id,
                    botoes: lista.filter(noArAgora).map((b) => ({
                      id: b.id,
                      label: b.label || "Sem texto",
                      icon: b.icon || null,
                      destaque: b.destaque,
                    })),
                  }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Tudo o que você mexe aqui aparece no preview na hora. Só vai para o
              ar depois de salvar.
            </p>
          </aside>
        </div>
      </form>

      {/* O card da Meta fica fora do formulário de cima: formulário dentro de
          formulário é HTML inválido, e o token não tem por que viajar junto com
          a aparência. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <CartaoMeta pagina={pagina} temToken={temToken} />
      </div>
    </main>
  );
}

function CartaoMeta({ pagina, temToken }: { pagina: LinkPage; temToken: boolean }) {
  const [resultado, salvar] = useFormState(salvarMeta, null);
  const [remocao, remover] = useFormState(removerToken, null);
  const removido = Boolean(remocao && "ok" in remocao);

  return (
    <Cartao
      titulo="Meta — Pixel e Conversions API"
      descricao="Os dois vêm do mesmo pixel, no Gerenciador de Eventos. O Pixel mede pelo navegador; o token faz o mesmo evento sair pelo servidor, que é o que continua contando com bloqueador de anúncio ligado. Um sem o outro não deduplica."
    >
      {resultado && "erro" in resultado ? <Aviso>{resultado.erro}</Aviso> : null}

      <form action={salvar} className="space-y-4">
        <input type="hidden" name="page_id" value={pagina.id} />

        <Campo rotulo="ID do Pixel" className="sm:max-w-sm">
          <Entrada
            name="pixel_id"
            defaultValue={pagina.pixel_id ?? ""}
            placeholder="só números"
          />
        </Campo>

        <Campo
          rotulo="Token da Conversions API"
          className="sm:max-w-sm"
          ajuda={
            temToken && !removido
              ? "Configurado — por segurança, não é exibido de volta."
              : "Não configurado."
          }
        >
          <Entrada
            name="capi_token"
            type="password"
            autoComplete="off"
            placeholder={temToken && !removido ? "deixe vazio para manter" : "colar token"}
          />
        </Campo>

        <BotaoEnviar pendente="Salvando…">Salvar Meta</BotaoEnviar>
      </form>

      {temToken && !removido ? (
        <form action={remover} className="mt-3">
          <input type="hidden" name="page_id" value={pagina.id} />
          <BotaoEnviar variante="destrutivo" tamanho="sm" pendente="Removendo…">
            Remover token
          </BotaoEnviar>
        </form>
      ) : null}
    </Cartao>
  );
}
