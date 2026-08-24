"use client";

import { useMemo, useState, useTransition } from "react";
import { precos, formatarBRL, type VariaveisPreco } from "@/lib/precificacao";
import { formatarDinheiro, paraNumero } from "@/lib/numero";
import {
  Aviso,
  Botao,
  Campo,
  ConfirmarAcao,
  Entrada,
  Rodinha,
  Tabela,
  Vazio,
  campoEstilo,
  numEstilo,
  tdEstilo,
  thEstilo,
} from "@/components/ui";
import {
  salvarPrecificacao,
  type ResultadoPrecificacao,
} from "./salvar";

export type ProdutoPreco = { id: string; name: string; preco_balcao: number };

/**
 * Precificação iFood.
 *
 * O que mudou: a conta acontece enquanto se digita. Antes, mexer em qualquer
 * das quatro variáveis exigia apertar "Recalcular" e esperar a página inteira
 * voltar do servidor para ver o efeito nos preços — que é justamente a pergunta
 * que a tela existe para responder.
 */
export function TabelaPrecificacao({
  orgId,
  variaveisIniciais,
  produtos,
  apagarProduto,
}: {
  orgId: string;
  variaveisIniciais: VariaveisPreco;
  produtos: ProdutoPreco[];
  apagarProduto: (formData: FormData) => void | Promise<void>;
}) {
  const [variaveis, setVariaveis] = useState(variaveisIniciais);
  const [precosEditados, setPrecosEditados] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        produtos.map((p) => [p.id, formatarDinheiro(Number(p.preco_balcao))]),
      ),
  );
  const [busca, setBusca] = useState("");
  const [resultado, setResultado] = useState<ResultadoPrecificacao | null>(null);
  const [salvando, iniciarSalvamento] = useTransition();

  const alteracoes = useMemo(
    () =>
      produtos
        .map((p) => ({
          id: p.id,
          preco_balcao: paraNumero(precosEditados[p.id] ?? "") ?? 0,
          original: Number(p.preco_balcao),
        }))
        .filter((p) => Math.abs(p.preco_balcao - p.original) > 0.0001)
        .map(({ id, preco_balcao }) => ({ id, preco_balcao })),
    [produtos, precosEditados],
  );

  const variaveisMudaram =
    variaveis.taxa_extra !== variaveisIniciais.taxa_extra ||
    variaveis.campanha !== variaveisIniciais.campanha ||
    variaveis.entrega !== variaveisIniciais.entrega ||
    variaveis.cupom !== variaveisIniciais.cupom;

  const pendente = alteracoes.length > 0 || variaveisMudaram;

  const lista = busca
    ? produtos.filter((p) => p.name.toLowerCase().includes(busca.toLowerCase()))
    : produtos;

  function salvar() {
    setResultado(null);
    iniciarSalvamento(async () => {
      setResultado(await salvarPrecificacao(orgId, variaveis, alteracoes));
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Variáveis ───────────────────────────────────────────────── */}
      <section className="rounded-lg border border-line bg-surface-1 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold">Variáveis</h2>
          <p className="text-xs text-dim">
            Os preços abaixo mudam enquanto você digita.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CampoVariavel
            rotulo="Taxa extra (%)"
            valor={variaveis.taxa_extra}
            aoMudar={(v) => setVariaveis((a) => ({ ...a, taxa_extra: v }))}
          />
          <CampoVariavel
            rotulo="Campanha (R$)"
            valor={variaveis.campanha}
            aoMudar={(v) => setVariaveis((a) => ({ ...a, campanha: v }))}
          />
          <CampoVariavel
            rotulo="Entrega grátis (R$)"
            valor={variaveis.entrega}
            aoMudar={(v) => setVariaveis((a) => ({ ...a, entrega: v }))}
          />
          <CampoVariavel
            rotulo="Cupom (R$)"
            valor={variaveis.cupom}
            aoMudar={(v) => setVariaveis((a) => ({ ...a, cupom: v }))}
          />
        </div>
      </section>

      {/* ── Produtos ────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-line bg-surface-1 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">
            Produtos <span className="text-sm font-normal text-dim">({produtos.length})</span>
          </h2>
          <div className="relative w-full sm:w-64">
            <label htmlFor="filtro" className="sr-only">
              Filtrar produtos
            </label>
            <input
              id="filtro"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por nome…"
              className="min-h-9 w-full rounded-md border border-line-strong bg-surface-2 px-3 py-1.5 text-sm outline-none transition placeholder:text-dim focus:border-brand"
            />
          </div>
        </div>

        {lista.length === 0 ? (
          <Vazio
            titulo={
              busca ? `Nenhum produto com “${busca}”` : "Nenhum produto cadastrado"
            }
            descricao={busca ? undefined : "Cadastre o primeiro em “Novo produto”."}
          />
        ) : (
          <>
            <div className="hidden lg:block">
              <Tabela>
                <thead>
                  <tr>
                    <th className={thEstilo}>Produto</th>
                    <th className={`${thEstilo} ${numEstilo}`}>Balcão</th>
                    <th className={`${thEstilo} ${numEstilo}`}>Fase 1</th>
                    <th className={`${thEstilo} ${numEstilo}`}>Fase 2</th>
                    <th className={`${thEstilo} ${numEstilo}`}>Fase 3</th>
                    <th className={thEstilo} />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((p) => {
                    const balcao = paraNumero(precosEditados[p.id] ?? "") ?? 0;
                    const { f1, f2, f3, pct } = precos(balcao, variaveis);
                    const mudou =
                      Math.abs(balcao - Number(p.preco_balcao)) > 0.0001;
                    return (
                      <tr key={p.id} className="transition hover:bg-surface-2/60">
                        <td className={`${tdEstilo} font-medium`}>
                          {p.name}
                          {mudou ? (
                            <span className="ml-2 text-[11px] font-semibold text-brand-ink">
                              alterado
                            </span>
                          ) : null}
                        </td>
                        <td className={`${tdEstilo} ${numEstilo}`}>
                          <input
                            value={precosEditados[p.id] ?? ""}
                            onChange={(e) =>
                              setPrecosEditados((a) => ({
                                ...a,
                                [p.id]: e.target.value,
                              }))
                            }
                            onBlur={(e) =>
                              setPrecosEditados((a) => ({
                                ...a,
                                [p.id]: formatarCampoDinheiro(e.target.value),
                              }))
                            }
                            inputMode="decimal"
                            aria-label={`Preço de balcão de ${p.name}`}
                            className={`w-28 rounded-md border bg-surface-2 px-2.5 py-1.5 text-right text-sm tabular outline-none transition focus:border-brand ${
                              mudou ? "border-brand-ink" : "border-line-strong"
                            }`}
                          />
                        </td>
                        <td className={`${tdEstilo} ${numEstilo} text-muted`}>
                          {formatarBRL(f1)}
                        </td>
                        <td className={`${tdEstilo} ${numEstilo} text-muted`}>
                          {formatarBRL(f2)}
                        </td>
                        <td className={`${tdEstilo} ${numEstilo}`}>
                          <span className="font-semibold">{formatarBRL(f3)}</span>
                          <Margem pct={pct} />
                        </td>
                        <td className={`${tdEstilo} ${numEstilo}`}>
                          <ConfirmarAcao
                            acao={apagarProduto}
                            rotulo="Remover"
                            titulo={`Remover ${p.name}?`}
                            descricao="O produto sai desta tabela de precificação. O cardápio do cliente não muda."
                            confirmar="Remover produto"
                          >
                            <input type="hidden" name="org_id" value={orgId} />
                            <input type="hidden" name="id" value={p.id} />
                          </ConfirmarAcao>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Tabela>
            </div>

            {/* Cinco colunas de dinheiro não cabem em 390px. */}
            <ul className="space-y-2 lg:hidden">
              {lista.map((p) => {
                const balcao = paraNumero(precosEditados[p.id] ?? "") ?? 0;
                const { f3, pct } = precos(balcao, variaveis);
                return (
                  <li
                    key={p.id}
                    className="rounded-lg border border-line bg-surface-2 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {p.name}
                      </p>
                      <ConfirmarAcao
                        acao={apagarProduto}
                        rotulo="Remover"
                        titulo={`Remover ${p.name}?`}
                        descricao="O produto sai desta tabela de precificação. O cardápio do cliente não muda."
                        confirmar="Remover produto"
                      >
                        <input type="hidden" name="org_id" value={orgId} />
                        <input type="hidden" name="id" value={p.id} />
                      </ConfirmarAcao>
                    </div>
                    <div className="mt-3 flex items-end gap-3">
                      <label className="flex-1">
                        <span className="mb-1 block text-[11px] font-semibold text-dim">
                          Balcão
                        </span>
                        <input
                          value={precosEditados[p.id] ?? ""}
                          onChange={(e) =>
                            setPrecosEditados((a) => ({
                              ...a,
                              [p.id]: e.target.value,
                            }))
                          }
                          onBlur={(e) =>
                            setPrecosEditados((a) => ({
                              ...a,
                              [p.id]: formatarCampoDinheiro(e.target.value),
                            }))
                          }
                          inputMode="decimal"
                          className={`${campoEstilo} tabular text-right`}
                        />
                      </label>
                      <div className="flex-1 text-right">
                        <span className="mb-1 block text-[11px] font-semibold text-dim">
                          Fase 3
                        </span>
                        <p className="min-h-11 pt-2 text-sm font-semibold tabular sm:min-h-10">
                          {formatarBRL(f3)}
                          <Margem pct={pct} />
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {resultado && "erro" in resultado ? (
        <Aviso tom="erro">{resultado.erro}</Aviso>
      ) : null}

      {/* Barra fixa: com 96 produtos, botão no fim da página é botão que não se
          acha. */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 bg-gradient-to-t from-canvas via-canvas to-transparent py-4">
        <Botao onClick={salvar} disabled={!pendente || salvando}>
          {salvando ? <Rodinha /> : null}
          {salvando ? "Salvando…" : "Salvar alterações"}
        </Botao>
        <p className="text-xs text-dim">
          {pendente
            ? `${alteracoes.length} ${alteracoes.length === 1 ? "preço" : "preços"}${
                variaveisMudaram ? " + variáveis" : ""
              } por salvar`
            : resultado && "ok" in resultado
              ? "Tudo salvo."
              : "Nada alterado."}
        </p>
      </div>
    </div>
  );
}

function formatarCampoDinheiro(texto: string) {
  const n = paraNumero(texto);
  return n === null ? texto : formatarDinheiro(n);
}

/** Quanto a Fase 3 ficou acima do balcão. Verde a partir de +38%. */
function Margem({ pct }: { pct: number }) {
  const cor = pct >= 38 ? "text-ok" : pct >= 25 ? "text-warn" : "text-danger";
  return (
    <span className={`ml-2 text-xs font-semibold ${cor}`}>
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(1).replace(".", ",")}%
    </span>
  );
}

function CampoVariavel({
  rotulo,
  valor,
  aoMudar,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (valor: number) => void;
}) {
  const [texto, setTexto] = useState(() => String(valor).replace(".", ","));
  return (
    <Campo rotulo={rotulo}>
      <Entrada
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          aoMudar(paraNumero(e.target.value) ?? 0);
        }}
        inputMode="decimal"
        className="tabular text-right"
      />
    </Campo>
  );
}
