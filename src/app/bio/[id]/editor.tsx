"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BioRender } from "@/components/bio-render";
import { botaoEstilo, campoEstilo } from "@/components/ui";
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
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={pagina.active}
                  className="h-4 w-4 accent-brand"
                />
                Página no ar
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

            <form
              action={criarBotao}
              className="mt-5 flex flex-wrap gap-3 border-t border-line pt-5"
            >
              <input type="hidden" name="page_id" value={pagina.id} />
              <input
                name="icon"
                placeholder="🍔"
                aria-label="Ícone"
                className={`${campoEstilo} w-16 text-center`}
              />
              <input
                name="label"
                required
                placeholder="Texto do botão"
                className={`${campoEstilo} sm:w-52`}
              />
              <input
                name="url"
                required
                placeholder="https://..."
                className={`${campoEstilo} sm:w-64`}
              />
              <button type="submit" className={`${botaoEstilo("primario")}`}>
                Adicionar
              </button>
            </form>
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
                  tema: cores,
                  pixelId: pagina.pixel_id,
                  botoes: ordem
                    .filter((b) => botaoNoAr(b))
                    .map((b) => ({ id: b.id, label: b.label, icon: b.icon })),
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            Título, descrição, foto e cores atualizam enquanto você digita. Os
            botões atualizam ao salvar.
          </p>
        </aside>
      </div>
    </main>
  );
}
