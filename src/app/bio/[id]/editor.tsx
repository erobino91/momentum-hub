"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BioRender } from "@/components/bio-render";
import { botaoEstilo, campoEstilo } from "@/components/ui";
import { NICHOS, NICHOS_LISTA, nichoDe, paletaDoNicho } from "@/lib/bio/nichos";
import { URL_BIO } from "@/lib/bio/url";
import {
  apagarBotao,
  criarBotao,
  removerToken,
  reordenarBotoes,
  salvarBotao,
  salvarMeta,
  salvarPagina,
} from "../actions";
import {
  botaoNoAr,
  temaCompleto,
  type LinkButton,
  type LinkPage,
} from "@/types/bio";

const rotulo = "block text-xs font-medium uppercase tracking-wider text-muted";
const caixa = "rounded-lg border border-line-strong bg-surface-1 p-5";

/** `datetime-local` não aceita ISO com fuso; corta no minuto. */
function paraInput(iso: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 16) : "";
}

export function EditorBio({
  pagina,
  botoes,
  temToken,
  erro,
}: {
  pagina: LinkPage;
  botoes: LinkButton[];
  temToken: boolean;
  erro?: string;
}) {
  const tema = temaCompleto(pagina.theme);

  // Estado só do que o preview mostra — o resto vai direto no form.
  const [titulo, setTitulo] = useState(pagina.title);
  const [bio, setBio] = useState(pagina.bio ?? "");
  const [avatar, setAvatar] = useState(pagina.avatar_url ?? "");
  const [cores, setCores] = useState(tema);
  const [nicho, setNicho] = useState(nichoDe(tema.nicho));
  // O degradê é opcional: sem isto, `input[type=color]` sem valor viraria preto
  // e toda página passaria a ter um gradiente que ninguém pediu.
  const [gradiente, setGradiente] = useState(Boolean(tema.fundo2));

  // Campos do formulário de novo botão — as sugestões do nicho preenchem eles.
  const [novoIcone, setNovoIcone] = useState("");
  const [novoRotulo, setNovoRotulo] = useState("");
  const urlNovo = useRef<HTMLInputElement>(null);

  function usarSugestao(icon: string, label: string) {
    setNovoIcone(icon);
    setNovoRotulo(label);
    urlNovo.current?.focus();
  }

  function aplicarPaleta() {
    const paleta = paletaDoNicho(nicho);
    setCores(paleta);
    setGradiente(Boolean(paleta.fundo2));
  }

  const [ordem, setOrdem] = useState(botoes);
  const [arrastando, setArrastando] = useState<string | null>(null);

  // Depois de salvar, o servidor manda a lista nova; o estado local acompanha.
  useEffect(() => setOrdem(botoes), [botoes]);

  function soltar(alvoId: string) {
    if (!arrastando || arrastando === alvoId) return;
    const nova = [...ordem];
    const de = nova.findIndex((b) => b.id === arrastando);
    const para = nova.findIndex((b) => b.id === alvoId);
    if (de < 0 || para < 0) return;
    nova.splice(para, 0, nova.splice(de, 1)[0]);
    setOrdem(nova);
    setArrastando(null);
    void reordenarBotoes(pagina.id, nova.map((b) => b.id));
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-muted">Bio</p>
          <h1 className="mt-2 truncate text-3xl font-semibold">{pagina.title}</h1>
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

      {erro ? (
        <p className="mt-6 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {erro}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* ---------------------------------------------------- página */}
          <section className={caixa}>
            <h2 className="text-lg font-medium">Página</h2>
            <form action={salvarPagina} className="mt-4 space-y-4">
              <input type="hidden" name="page_id" value={pagina.id} />

              <div>
                <label className={rotulo} htmlFor="title">
                  Título
                </label>
                <input
                  id="title"
                  name="title"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className={`${campoEstilo} mt-1`}
                />
              </div>

              <div>
                <label className={rotulo} htmlFor="bio">
                  Descrição
                </label>
                <textarea
                  id="bio"
                  name="bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className={`${campoEstilo} mt-1`}
                />
              </div>

              <div>
                <label className={rotulo} htmlFor="avatar_url">
                  Foto (URL)
                </label>
                <input
                  id="avatar_url"
                  name="avatar_url"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="https://..."
                  className={`${campoEstilo} mt-1`}
                />
              </div>

              {/* O nicho escolhe o visual da página pública: layout de
                  vitrine, textura de fundo e forma dos cartões. As cores dele
                  são sugestão — só entram quando alguém pede. */}
              <div>
                <label className={rotulo} htmlFor="nicho">
                  Nicho
                </label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <select
                    id="nicho"
                    name="nicho"
                    value={nicho}
                    onChange={(e) => setNicho(nichoDe(e.target.value))}
                    className={`${campoEstilo} sm:w-64`}
                  >
                    {NICHOS_LISTA.map((n) => (
                      <option key={n} value={n}>
                        {NICHOS[n].nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={aplicarPaleta}
                    className="text-sm text-muted underline-offset-4 transition hover:text-foreground hover:underline"
                  >
                    Aplicar cores do nicho
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-dim">{NICHOS[nicho].descricao}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(
                  [
                    ["tema_fundo", "Fundo", "fundo"],
                    ["tema_texto", "Texto", "texto"],
                    ["tema_botao", "Botão", "botao"],
                    ["tema_botao_texto", "Texto do botão", "botaoTexto"],
                  ] as const
                ).map(([campo, nome, chave]) => (
                  <div key={campo}>
                    <label className={rotulo} htmlFor={campo}>
                      {nome}
                    </label>
                    <input
                      id={campo}
                      name={campo}
                      type="color"
                      value={cores[chave]}
                      onChange={(e) =>
                        setCores({ ...cores, [chave]: e.target.value })
                      }
                      className="mt-1 h-10 w-full cursor-pointer rounded-md border border-line-strong bg-surface-1"
                    />
                  </div>
                ))}

                {nicho === "classico" ? null : (
                  <div>
                    <label className={rotulo} htmlFor="tema_destaque">
                      Destaque
                    </label>
                    <input
                      id="tema_destaque"
                      name="tema_destaque"
                      type="color"
                      value={cores.destaque}
                      onChange={(e) =>
                        setCores({ ...cores, destaque: e.target.value })
                      }
                      className="mt-1 h-10 w-full cursor-pointer rounded-md border border-line-strong bg-surface-1"
                    />
                  </div>
                )}

                <div>
                  <label className={rotulo} htmlFor="tema_fundo2">
                    Fundo 2
                  </label>
                  <input
                    id="tema_fundo2"
                    name="tema_fundo2"
                    type="color"
                    disabled={!gradiente}
                    value={cores.fundo2 || cores.fundo}
                    onChange={(e) => setCores({ ...cores, fundo2: e.target.value })}
                    className="mt-1 h-10 w-full cursor-pointer rounded-md border border-line-strong bg-surface-1 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Desmarcado, o campo vai desabilitado e não é enviado — o tema
                  volta a ter fundo chapado sem precisar de valor nenhum. */}
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
                  name="active"
                  defaultChecked={pagina.active}
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

              <button type="submit" className={`${botaoEstilo("primario")} sm:w-auto sm:px-6`}>
                Salvar página
              </button>
            </form>
          </section>

          {/* ---------------------------------------------------- botões */}
          <section className={caixa}>
            <h2 className="text-lg font-medium">Botões</h2>
            <p className="mt-1 text-sm text-muted">
              Arraste pela alça <span aria-hidden>⠿</span> para mudar a ordem.
            </p>

            <div className="mt-4 space-y-3">
              {ordem.map((b) => (
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

                    <form action={salvarBotao} className="flex-1 space-y-3">
                      <input type="hidden" name="page_id" value={pagina.id} />
                      <input type="hidden" name="botao_id" value={b.id} />

                      <div className="flex flex-wrap gap-3">
                        <input
                          name="icon"
                          defaultValue={b.icon ?? ""}
                          placeholder="🍔"
                          aria-label="Ícone"
                          className={`${campoEstilo} w-16 text-center`}
                        />
                        <input
                          name="label"
                          defaultValue={b.label}
                          placeholder="Texto do botão"
                          aria-label="Texto do botão"
                          className={`${campoEstilo} flex-1 sm:min-w-[12rem]`}
                        />
                      </div>

                      <input
                        name="url"
                        defaultValue={b.url}
                        placeholder="https://..."
                        aria-label="Link de destino"
                        className={campoEstilo}
                      />

                      <details className="text-sm text-muted">
                        <summary className="cursor-pointer">Agendamento</summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className={rotulo}>Começa em</label>
                            <input
                              type="datetime-local"
                              name="starts_at"
                              defaultValue={paraInput(b.starts_at)}
                              className={`${campoEstilo} mt-1`}
                            />
                          </div>
                          <div>
                            <label className={rotulo}>Termina em</label>
                            <input
                              type="datetime-local"
                              name="ends_at"
                              defaultValue={paraInput(b.ends_at)}
                              className={`${campoEstilo} mt-1`}
                            />
                          </div>
                        </div>
                      </details>

                      <div className="flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            name="active"
                            defaultChecked={b.active}
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
                            name="destaque"
                            defaultChecked={b.destaque}
                            className="h-4 w-4 accent-brand"
                          />
                          Destaque
                        </label>
                        <button
                          type="submit"
                          className="text-sm text-muted transition hover:text-foreground"
                        >
                          Salvar
                        </button>
                        <button
                          type="submit"
                          formAction={apagarBotao}
                          className="text-sm text-danger transition hover:text-danger"
                        >
                          Apagar
                        </button>
                        {!botaoNoAr(b) ? (
                          <span className="text-xs text-muted">
                            fora do ar agora
                          </span>
                        ) : null}
                      </div>
                    </form>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-line pt-5">
              {/* As sugestões só preenchem o formulário. Criar o botão já
                  pronto exigiria uma URL de mentira, e URL de mentira publica
                  link quebrado. */}
              {NICHOS[nicho].sugestoes.length > 0 ? (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">Sugestões do nicho:</span>
                  {NICHOS[nicho].sugestoes.map((sg) => (
                    <button
                      key={sg.label}
                      type="button"
                      onClick={() => usarSugestao(sg.icon, sg.label)}
                      className="rounded-full border border-line bg-surface-2 px-3 py-1 text-sm transition hover:border-line-strong hover:text-foreground"
                    >
                      <span aria-hidden>{sg.icon}</span> {sg.label}
                    </button>
                  ))}
                </div>
              ) : null}

              <form action={criarBotao} className="flex flex-wrap gap-3">
                <input type="hidden" name="page_id" value={pagina.id} />
                <input
                  name="icon"
                  value={novoIcone}
                  onChange={(e) => setNovoIcone(e.target.value)}
                  placeholder="🍔"
                  aria-label="Ícone"
                  className={`${campoEstilo} w-16 text-center`}
                />
                <input
                  name="label"
                  required
                  value={novoRotulo}
                  onChange={(e) => setNovoRotulo(e.target.value)}
                  placeholder="Texto do botão"
                  className={`${campoEstilo} sm:w-52`}
                />
                <input
                  ref={urlNovo}
                  name="url"
                  required
                  placeholder="https://..."
                  className={`${campoEstilo} sm:w-64`}
                />
                <button type="submit" className={`${botaoEstilo("primario")}`}>
                  Adicionar
                </button>
              </form>
            </div>
          </section>

          {/* ---------------------------------------------------- Meta */}
          <section className={caixa}>
            <h2 className="text-lg font-medium">Meta — Pixel e Conversions API</h2>
            <p className="mt-1 text-sm text-muted">
              Os dois vêm do mesmo pixel, no Gerenciador de Eventos. O Pixel mede
              pelo navegador; o token faz o mesmo evento sair pelo servidor, que é
              o que continua contando com bloqueador de anúncio ligado. Um sem o
              outro não deduplica.
            </p>

            <form action={salvarMeta} className="mt-4 space-y-4">
              <input type="hidden" name="page_id" value={pagina.id} />

              <div>
                <label className={rotulo} htmlFor="pixel_id">
                  ID do Pixel
                </label>
                <input
                  id="pixel_id"
                  name="pixel_id"
                  defaultValue={pagina.pixel_id ?? ""}
                  placeholder="só números"
                  className={`${campoEstilo} mt-1 sm:w-80`}
                />
              </div>

              <div>
                <label className={rotulo} htmlFor="capi_token">
                  Token da Conversions API
                </label>
                <input
                  id="capi_token"
                  name="capi_token"
                  type="password"
                  autoComplete="off"
                  placeholder={temToken ? "deixe vazio para manter" : "colar token"}
                  className={`${campoEstilo} mt-1 sm:w-80`}
                />
                <p className="mt-1.5 text-xs text-muted">
                  Status:{" "}
                  <span className={temToken ? "text-ok" : "text-muted"}>
                    {temToken ? "configurado" : "não configurado"}
                  </span>
                  {temToken ? " · por segurança, não é exibido de volta" : null}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <button type="submit" className={`${botaoEstilo("primario")} sm:w-auto sm:px-6`}>
                  Salvar
                </button>
                {temToken ? (
                  <button
                    type="submit"
                    formAction={removerToken}
                    className="text-sm text-danger transition hover:text-danger"
                  >
                    Remover token
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>

        {/* ------------------------------------------------------ preview */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <p className={rotulo}>Preview</p>
          <div className="mt-2 overflow-hidden rounded-[2rem] border-4 border-line-strong">
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
                  botoes: ordem
                    .filter((b) => botaoNoAr(b))
                    .map((b) => ({
                      id: b.id,
                      label: b.label,
                      icon: b.icon,
                      destaque: b.destaque,
                    })),
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Título, descrição, foto, nicho e cores atualizam enquanto você
            mexe. Os botões atualizam ao salvar.
          </p>
        </aside>
      </div>
    </main>
  );
}
