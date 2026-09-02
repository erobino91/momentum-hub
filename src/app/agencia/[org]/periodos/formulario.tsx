"use client";

import { Fragment, useMemo, useState } from "react";
import {
  GRUPOS_PERIODO,
  CAMPOS_PERIODO,
  nomeDoMes,
  type CampoPeriodo,
} from "@/lib/periodos";
import {
  formatarCampo,
  formatarDinheiro,
  paraNumero,
} from "@/lib/numero";
import { AreaTexto, BotaoEnviar, Campo, campoEstilo } from "@/components/ui";

/**
 * Fechamento do mês.
 *
 * Eram 24 campos `type="number"` abertos ao mesmo tempo, com o botão de salvar
 * no fim de uma página longa e nenhum sinal de que o envio começou. Três coisas
 * mudam aqui:
 *
 * 1. **Número em português.** O campo aceita `147.456,00`, `147456,00` e o
 *    formato americano colado de planilha, e normaliza quando o cursor sai.
 * 2. **O que é conta não se digita.** Faturamento total é a soma das partes e
 *    ticket médio é faturamento ÷ pedidos — os dois viram campo calculado.
 * 3. **Grupo vazio fica recolhido.** Quem fecha um cliente só de salão não
 *    precisa rolar por quinze campos de funil que nunca preenche.
 *
 * O mês anterior aparece como sugestão embaixo do campo, e **não** como um
 * botão de copiar: repetir o mês passado inteiro com um clique é a maneira mais
 * fácil de publicar o número velho como se fosse o novo.
 */
export function FormularioPeriodo({
  orgId,
  acao,
  valoresIniciais,
  anterior,
  mesAnterior,
  mesSugerido,
  editando,
  obsRaw,
  obsPolished,
  metaSincronizado,
  cancelar,
}: {
  orgId: string;
  acao: (formData: FormData) => void | Promise<void>;
  valoresIniciais: Record<string, string>;
  /** Valores do mês anterior, só para sugerir. */
  anterior: Record<string, string> | null;
  mesAnterior: string | null;
  /** `2026-08` — mês novo sugerido. */
  mesSugerido: string;
  /** Data do mês em edição, se for edição. */
  editando: string | null;
  obsRaw: string;
  obsPolished: string;
  /** A empresa tem conta de anúncio vinculada: o Meta não se digita. */
  metaSincronizado: boolean;
  cancelar: React.ReactNode;
}) {
  const [valores, setValores] = useState<Record<string, string>>(valoresIniciais);

  const num = (coluna: string) => paraNumero(valores[coluna] ?? "");

  // Faturamento total nunca foi digitado de verdade: a tela pedia o campo e o
  // dashboard do cliente ignorava a coluna, recompondo o total das partes. Quem
  // digitasse um total que não fechava nunca descobriria.
  const fatTotal =
    (num("fat_mesa") ?? 0) + (num("fat_delivery") ?? 0) + (num("fat_ifood") ?? 0);
  const temAlgumaParte =
    num("fat_mesa") !== null ||
    num("fat_delivery") !== null ||
    num("fat_ifood") !== null;

  const razao = (a: string, b: string) => {
    const cima = num(a);
    const baixo = num(b);
    if (cima === null || !baixo) return null;
    return cima / baixo;
  };

  // Campo que a empresa não digita não entra na conta de "quantos faltam" —
  // nem o total de faturamento, nem o Meta de quem tem conta vinculada.
  const digitavel = (campo: CampoPeriodo) =>
    campo.coluna !== "fat_total" && !(campo.origem === "meta" && metaSincronizado);

  const preenchidos = useMemo(
    () =>
      CAMPOS_PERIODO.filter(
        (c) => digitavel(c) && paraNumero(valores[c.coluna] ?? "") !== null,
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valores, metaSincronizado],
  );
  const total = CAMPOS_PERIODO.filter(digitavel).length;

  const [abertos, setAbertos] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      GRUPOS_PERIODO.map((g, i) => [
        g.titulo,
        // O primeiro grupo sempre abre; os outros, só se já tiverem número.
        i === 0 || g.campos.some((c) => (valoresIniciais[c.coluna] ?? "") !== ""),
      ]),
    ),
  );

  return (
    <form action={acao}>
      <input type="hidden" name="org_id" value={orgId} />
      {/* Calculado, mas gravado: assim a coluna deixa de discordar da soma. */}
      <input
        type="hidden"
        name="fat_total"
        value={temAlgumaParte ? String(fatTotal) : ""}
      />

      <div className="mb-5 flex flex-wrap items-end gap-4">
        <Campo rotulo="Mês" obrigatorio className="w-48">
          <input
            type="month"
            name="period_date"
            required
            defaultValue={editando ? editando.slice(0, 7) : mesSugerido}
            readOnly={Boolean(editando)}
            className={campoEstilo}
          />
        </Campo>
        {editando ? (
          <p className="pb-2.5 text-xs text-dim">
            Para lançar outro mês, cancele a edição.
          </p>
        ) : null}
        <div className="ml-auto pb-1 text-sm">
          <span className="tabular font-semibold">{preenchidos}</span>
          <span className="text-dim"> de {total} campos</span>
        </div>
      </div>

      <div className="space-y-2.5 pb-2">
        {GRUPOS_PERIODO.map((grupo) => {
          const campos = grupo.campos.filter((c) => c.coluna !== "fat_total");
          const aDigitar = campos.filter(digitavel);
          const comValor = aDigitar.filter(
            (c) => paraNumero(valores[c.coluna] ?? "") !== null,
          ).length;
          const aberto = abertos[grupo.titulo];

          return (
            <details
              key={grupo.titulo}
              open={aberto}
              onToggle={(e) =>
                setAbertos((a) => ({
                  ...a,
                  [grupo.titulo]: (e.target as HTMLDetailsElement).open,
                }))
              }
              className="rounded-lg border border-line bg-surface-1"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span
                  aria-hidden
                  className={`text-dim transition-transform ${aberto ? "rotate-90" : ""}`}
                >
                  ▸
                </span>
                <span className="text-sm font-semibold">{grupo.titulo}</span>
                <span className="ml-auto text-xs tabular text-dim">
                  {aDigitar.length === 0
                    ? "vem do Meta"
                    : `${comValor} de ${aDigitar.length}`}
                </span>
              </summary>

              <div className="border-t border-line px-4 pb-4 pt-3.5">
                {grupo.ajuda ? (
                  <p className="mb-3 text-xs text-dim">{grupo.ajuda}</p>
                ) : null}
                {aDigitar.length === 0 ? (
                  <p className="mb-3 text-xs text-dim">
                    Vem da conta de anúncio vinculada. Para voltar a digitar,
                    remova a conta na aba Geral.
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {campos.map((campo) => (
                    <Fragment key={campo.coluna}>
                      {digitavel(campo) ? (
                        <CampoNumero
                          campo={campo}
                          valor={valores[campo.coluna] ?? ""}
                          sugestao={
                            anterior && mesAnterior
                              ? anterior[campo.coluna] || null
                              : null
                          }
                          mesAnterior={mesAnterior}
                          aoMudar={(v) =>
                            setValores((atual) => ({ ...atual, [campo.coluna]: v }))
                          }
                        />
                      ) : (
                        // Mesmo tratamento do faturamento total e do ticket
                        // médio: o que não se digita não vira campo de texto.
                        <Calculado
                          rotulo={campo.rotulo}
                          valor={
                            valoresIniciais[campo.coluna]
                              ? `R$ ${valoresIniciais[campo.coluna]}`
                              : "—"
                          }
                          ajuda="Vem do Meta."
                        />
                      )}
                      {/* O total entra logo depois das três partes que ele soma. */}
                      {campo.coluna === "fat_ifood" ? (
                        <Calculado
                          rotulo="Total"
                          valor={
                            temAlgumaParte ? `R$ ${formatarDinheiro(fatTotal)}` : "—"
                          }
                          ajuda="Salão + delivery + iFood."
                        />
                      ) : null}
                    </Fragment>
                  ))}

                  {grupo.titulo === "Pedidos" ? (
                    <>
                      <Calculado
                        rotulo="Ticket salão"
                        valor={dinheiroOuTraco(razao("fat_mesa", "pedidos_mesa"))}
                      />
                      <Calculado
                        rotulo="Ticket delivery"
                        valor={dinheiroOuTraco(
                          razao("fat_delivery", "pedidos_delivery"),
                        )}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </details>
          );
        })}

        <div className="rounded-lg border border-line bg-surface-1 p-4">
          <p className="mb-3 text-sm font-semibold">Observações do mês</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              rotulo="Anotação interna"
              ajuda="Só a agência lê."
            >
              <AreaTexto name="obs_raw" rows={4} defaultValue={obsRaw} />
            </Campo>
            <Campo
              rotulo="Texto que o cliente lê"
              ajuda="Aparece no dashboard. Aceita **negrito**."
            >
              <AreaTexto name="obs_polished" rows={4} defaultValue={obsPolished} />
            </Campo>
          </div>
        </div>
      </div>

      {/* Barra fixa: com sete grupos abertos o botão ficava a três telas de
          distância do começo do formulário. */}
      <div className="sticky bottom-0 mt-4 flex flex-wrap items-center gap-3 bg-gradient-to-t from-canvas via-canvas to-transparent py-4">
        <BotaoEnviar pendente="Salvando…">
          {editando ? "Salvar alterações" : "Publicar mês"}
        </BotaoEnviar>
        {cancelar}
        <p className="ml-auto text-xs text-dim">
          Campo em branco fica vazio no dashboard; zero é zero de verdade.
        </p>
      </div>
    </form>
  );
}

function dinheiroOuTraco(valor: number | null) {
  return valor === null ? "—" : `R$ ${formatarDinheiro(valor)}`;
}

/**
 * Um campo numérico. O valor no estado é o texto que a pessoa digitou; a
 * normalização acontece ao sair do campo, não a cada tecla — corrigir o que o
 * outro está escrevendo no meio da digitação é o que fazia o campo antigo
 * brigar com quem colava de planilha.
 */
function CampoNumero({
  campo,
  valor,
  sugestao,
  mesAnterior,
  aoMudar,
}: {
  campo: CampoPeriodo;
  valor: string;
  sugestao: string | null;
  mesAnterior: string | null;
  aoMudar: (valor: string) => void;
}) {
  const dinheiro = campo.tipo === "dinheiro";
  const sugerido =
    sugestao && mesAnterior
      ? `${nomeDoMes(mesAnterior).split("/")[0]}: ${formatarCampo(sugestao, campo.tipo)}`
      : undefined;

  return (
    <Campo rotulo={campo.rotulo} ajuda={sugerido}>
      <div className="relative">
        {dinheiro ? (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-dim"
          >
            R$
          </span>
        ) : null}
        <input
          name={campo.coluna}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
          onBlur={(e) => aoMudar(formatarCampo(e.target.value, campo.tipo))}
          inputMode="decimal"
          autoComplete="off"
          placeholder="—"
          className={`${campoEstilo} tabular text-right ${dinheiro ? "pl-10" : ""}`}
        />
      </div>
    </Campo>
  );
}

/** Resultado de conta: mostrado, nunca digitado. */
function Calculado({
  rotulo,
  valor,
  ajuda,
}: {
  rotulo: string;
  valor: string;
  ajuda?: string;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-dim">{rotulo}</p>
      <p className="flex min-h-11 items-center justify-end rounded-md border border-dashed border-line-strong bg-canvas px-3 text-sm tabular text-muted sm:min-h-10">
        {valor}
      </p>
      {ajuda ? <p className="mt-1.5 text-xs text-dim">{ajuda}</p> : null}
    </div>
  );
}
