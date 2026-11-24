"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Aviso, BotaoEnviar, Botao, Campo, Entrada, Selo } from "@/components/ui";
import { FUSO } from "@/lib/data";
import type { PedidoRetirada } from "@/lib/retirada";
import { entrar, marcarRetirado } from "./acoes";

export function Entrar({ slug }: { slug: string }) {
  const [estado, acao] = useFormState(entrar.bind(null, slug), { erro: null });
  return (
    <form action={acao} className="mx-auto max-w-xs space-y-4 pt-10">
      <Campo rotulo="Código do balcão">
        <Entrada name="pin" inputMode="numeric" autoComplete="off" required autoFocus />
      </Campo>
      {estado.erro && <Aviso>{estado.erro}</Aviso>}
      <BotaoEnviar className="w-full">Entrar</BotaoEnviar>
    </form>
  );
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * A busca filtra no navegador, sem ir para a URL como o resto do hub: no balcão
 * cada letra precisa responder na hora, e ninguém compartilha esse link filtrado.
 */
export function Lista({ slug, pedidos }: { slug: string; pedidos: PedidoRetirada[] }) {
  const [busca, setBusca] = useState("");
  const [retirados, setRetirados] = useState(
    () => new Map(pedidos.map((p) => [p.id, p.retiradoEm])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const router = useRouter();
  const [atualizando, atualizar] = useTransition();
  const [lidoEm, setLidoEm] = useState(() => new Date().toISOString());

  // Atualizar traz pedidos novos e o que outro aparelho marcou.
  useEffect(() => {
    setRetirados(new Map(pedidos.map((p) => [p.id, p.retiradoEm])));
    setLidoEm(new Date().toISOString());
  }, [pedidos]);

  const visiveis = useMemo(() => {
    const q = normalizar(busca.trim());
    if (!q) return pedidos;
    return pedidos.filter(
      (p) => normalizar(p.nome).includes(q) || p.numero.includes(q) || p.fone.includes(q),
    );
  }, [busca, pedidos]);

  const totalLanches = pedidos.reduce((s, p) => s + p.lanches, 0);
  const feitos = pedidos.filter((p) => retirados.get(p.id));

  function alternar(id: string, marcar: boolean) {
    const antes = retirados.get(id) ?? null;
    setRetirados((m) => new Map(m).set(id, marcar ? new Date().toISOString() : null));
    setErro(null);
    iniciar(async () => {
      try {
        await marcarRetirado(slug, id, marcar);
      } catch {
        setRetirados((m) => new Map(m).set(id, antes));
        setErro("Não salvou. Confira a internet e toque de novo.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Pedidos", pedidos.length],
          ["Lanches", totalLanches],
          ["Retirados", `${feitos.length}/${pedidos.length}`],
        ].map(([rotulo, valor]) => (
          <div key={rotulo} className="rounded-lg border border-line bg-surface-1 px-2 py-3">
            <div className="text-2xl font-bold tabular-nums">{valor}</div>
            <div className="text-xs text-dim">{rotulo}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-dim">Lista de {hora(lidoEm)}</span>
        <Botao
          variante="secundario"
          disabled={atualizando}
          onClick={() => atualizar(() => router.refresh())}
        >
          {atualizando ? "Atualizando…" : "Atualizar"}
        </Botao>
      </div>

      <div className="sticky top-0 z-10 bg-canvas py-2">
        <Campo rotulo="Buscar por nome, nº do pedido ou final do telefone">
          <Entrada
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoComplete="off"
          />
        </Campo>
      </div>

      {erro && <Aviso>{erro}</Aviso>}

      {visiveis.length === 0 && (
        <p className="py-8 text-center text-sm text-dim">
          {pedidos.length === 0 ? "Nenhum pedido ainda." : "Nenhum pedido com essa busca."}
        </p>
      )}

      <ul className="space-y-2">
        {visiveis.map((p) => {
          const em = retirados.get(p.id);
          return (
            <li
              key={p.id}
              className={`rounded-lg border border-line bg-surface-1 p-3 ${em ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-base font-bold">{p.nome}</div>
                  <div className="text-xs text-dim">
                    Pedido {p.numero} · fone final {p.fone || "—"} · pediu {hora(p.criadoEm)}
                  </div>
                </div>
                <div className="flex-none text-right">
                  <div className="text-2xl font-bold tabular-nums">{p.lanches}</div>
                  <div className="text-[11px] text-dim">lanche{p.lanches === 1 ? "" : "s"}</div>
                </div>
              </div>

              <ul className="mt-2 space-y-0.5 text-sm">
                {p.itens.map((i, n) => (
                  <li key={n}>
                    <span className="font-semibold tabular-nums">{i.qtd}×</span> {i.nome}
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center justify-between gap-2">
                {em ? (
                  <>
                    <Selo tom="pronto">Retirado {hora(em)}</Selo>
                    <Botao variante="secundario" onClick={() => alternar(p.id, false)}>
                      ↩ Desfazer
                    </Botao>
                  </>
                ) : (
                  <Botao className="w-full" onClick={() => alternar(p.id, true)}>
                    Retirado
                  </Botao>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
