import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { campoClasse, botaoClasse } from "@/components/auth-shell";
import type { LiveMaterial, LiveSession, Org } from "@/types/db";
import { AtualizacaoAutomatica, Cronometro } from "./atualizacao-automatica";
import {
  enviarMaterial,
  apagarMaterial,
  iniciarLive,
  encerrarLive,
} from "./actions";

import { AgenciaShell } from "@/components/shell";
import { Aviso } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lives" };

const ROTULO_STATUS: Record<LiveSession["status"], string> = {
  starting: "iniciando",
  live: "no ar",
  ending: "encerrando",
  ended: "encerrada",
  error: "erro",
};

/**
 * Painel de lives — global, todas as empresas em uma tela só, como era o
 * `lives.html`.
 *
 * `stream_key` **não é selecionada aqui**. É a chave da transmissão do
 * Instagram do cliente e quem precisa dela é o worker, que lê o banco com a
 * chave secreta. A tela mostra o estado; o segredo entra pelo formulário e não
 * volta.
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
  const materiaisDe = (orgId: string) =>
    (materiais ?? []).filter((m) => m.org_id === orgId);
  const ativaDe = (orgId: string) => ativas.find((s) => s.org_id === orgId);

  return (
    <AgenciaShell
      secao="lives"
      migalha={[{ rotulo: "Lives" }]}
      titulo="Lives"
      acoes={<AtualizacaoAutomatica ativa={ativas.length > 0} />}
    >
      <p className="-mt-1 mb-6 max-w-2xl text-sm text-muted">
        Vídeo em loop para o Instagram Live. Quem transmite é o worker na
        máquina ligada — esta tela só manda o recado.
      </p>

      {searchParams.erro ? (
        <div className="mb-6">
          <Aviso tom="erro">{searchParams.erro}</Aviso>
        </div>
      ) : null}

      <div className="space-y-6">
        {(orgs ?? []).map((org) => {
          const lista = materiaisDe(org.id);
          const ativa = ativaDe(org.id);
          const prontos = lista.filter((m) => m.status === "ready");

          return (
            <section
              key={org.id}
              className="rounded-lg border border-white/15 bg-white/5 p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg font-medium">{org.name}</h2>
                {ativa ? (
                  <span className="rounded-full border border-accent bg-accent/15 px-3 py-1 text-xs">
                    {ROTULO_STATUS[ativa.status]}
                    {ativa.started_at ? (
                      <>
                        {" · "}
                        <Cronometro desde={ativa.started_at} />
                      </>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-xs text-muted">fora do ar</span>
                )}
              </div>

              {ativa ? (
                <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
                  <div className="text-sm">
                    <p className="text-muted">
                      Material:{" "}
                      {lista.find((m) => m.id === ativa.material_id)?.label ??
                        "—"}
                    </p>
                    {ativa.auto_cutoff_at ? (
                      <p className="mt-1 text-xs text-muted">
                        Corte automático às{" "}
                        {new Date(ativa.auto_cutoff_at).toLocaleTimeString(
                          "pt-BR",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </p>
                    ) : null}
                    {ativa.error_message ? (
                      <p className="mt-1 text-xs text-red-300">
                        {ativa.error_message}
                      </p>
                    ) : null}
                  </div>
                  <form action={encerrarLive} className="ml-auto">
                    <input type="hidden" name="id" value={ativa.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 transition hover:bg-red-500/20"
                    >
                      Encerrar live
                    </button>
                  </form>
                </div>
              ) : (
                <form
                  action={iniciarLive}
                  className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2"
                >
                  <input type="hidden" name="org_id" value={org.id} />
                  <label className="block text-sm">
                    <span className="text-muted">Material</span>
                    <select
                      name="material_id"
                      required
                      disabled={prontos.length === 0}
                      className={`${campoClasse} mt-1`}
                    >
                      {prontos.length === 0 ? (
                        <option value="">nenhum material pronto</option>
                      ) : (
                        prontos.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">
                      Servidor RTMPS (Live Producer)
                    </span>
                    <input
                      name="stream_url"
                      required
                      placeholder="rtmps://…"
                      autoComplete="off"
                      className={`${campoClasse} mt-1`}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">Chave da transmissão</span>
                    <input
                      name="stream_key"
                      required
                      type="password"
                      autoComplete="off"
                      className={`${campoClasse} mt-1`}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={prontos.length === 0}
                    className={`${botaoClasse} self-end disabled:opacity-40`}
                  >
                    Entrar no ar
                  </button>
                </form>
              )}

              {/* ── Materiais ──────────────────────────────────────────── */}
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="text-xs uppercase tracking-wider text-muted">
                  Materiais
                </p>

                {lista.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {lista.map((m) => (
                      <li
                        key={m.id}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <span>
                          {m.label}{" "}
                          <span
                            className={`text-xs ${
                              m.status === "ready"
                                ? "text-emerald-300"
                                : m.status === "error"
                                  ? "text-red-300"
                                  : "text-amber-300"
                            }`}
                          >
                            ·{" "}
                            {m.status === "ready"
                              ? "pronto"
                              : m.status === "error"
                                ? "falhou"
                                : "convertendo"}
                          </span>
                        </span>
                        <form action={apagarMaterial}>
                          <input type="hidden" name="id" value={m.id} />
                          <button
                            type="submit"
                            className="text-xs text-muted transition hover:text-red-300"
                          >
                            remover
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    Nenhum material enviado.
                  </p>
                )}

                <form
                  action={enviarMaterial}
                  className="mt-4 flex flex-wrap items-end gap-3"
                >
                  <input type="hidden" name="org_id" value={org.id} />
                  <label className="block text-sm">
                    <span className="text-muted">Nome</span>
                    <input
                      name="label"
                      required
                      placeholder="Ex.: promoção de terça"
                      className={`${campoClasse} mt-1 sm:w-56`}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="text-muted">Arquivo</span>
                    <input
                      name="arquivo"
                      type="file"
                      required
                      accept="video/*,image/*"
                      className={`${campoClasse} mt-1 sm:w-72`}
                    />
                  </label>
                  <button type="submit" className={`${botaoClasse} sm:w-auto sm:px-5`}>
                    Enviar
                  </button>
                </form>
              </div>
            </section>
          );
        })}
      </div>
    </AgenciaShell>
  );
}
