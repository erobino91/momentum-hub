"use client";

import { useRef, useState, useTransition } from "react";
import {
  AcoesDialogo,
  Botao,
  Campo,
  Dialogo,
  Entrada,
  Rodinha,
  Selo,
  Tabela,
  botaoEstilo,
  tdEstilo,
  thEstilo,
} from "@/components/ui";
import { Icone } from "@/components/icone";
import { dataEHora } from "@/lib/data";
import { formatarDinheiro, reais } from "@/lib/numero";
import {
  ROTULO_EVENTO,
  ROTULO_STATUS,
  STATUS_LEAD,
  esperaDemais,
  formatarTelefone,
  haQuanto,
  linkWhatsApp,
  type EventoMeta,
  type Lead,
  type StatusLead,
} from "@/lib/leads";
import { mudarStatus, reenviarEvento } from "@/app/agencia/leads/actions";

/**
 * Os leads em linhas (computador) ou cartões (celular), com a situação mudando
 * na própria linha.
 *
 * A situação é um `<select>` nativo: teclado, leitor de tela e alvo de toque
 * saem de graça. "Virou cliente" é a única que não muda direto — abre a janela
 * do valor, porque ele vai para a Meta como venda e lá não tem volta.
 *
 * Nada aqui muda de situação sozinho: chamar no WhatsApp é só um link.
 */

const PONTO: Record<StatusLead, string> = {
  novo: "bg-warn",
  conversando: "bg-muted",
  proposta: "bg-ok/50",
  sem_resposta: "bg-dim",
  cliente: "bg-ok",
  descartado: "bg-line-strong",
};

const TEXTO: Record<StatusLead, string> = {
  novo: "text-warn",
  conversando: "text-foreground",
  proposta: "text-foreground",
  sem_resposta: "text-muted",
  cliente: "text-ok",
  descartado: "text-dim",
};

/** Os eventos que a linha mostra: o Lead sempre; os outros, se já existiram. */
const ORDEM_EVENTOS: EventoMeta[] = ["Lead", "PropostaEnviada", "Purchase"];

export function TabelaLeads({ leads, agora }: { leads: Lead[]; agora: number }) {
  const [pendente, iniciar] = useTransition();
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Situação escolhida e ainda não confirmada pelo servidor.
  const [otimista, setOtimista] = useState<Record<string, StatusLead>>({});
  const [erros, setErros] = useState<Record<string, string>>({});

  const [venda, setVenda] = useState<Lead | null>(null);
  const [valor, setValor] = useState("");
  const [erroVenda, setErroVenda] = useState<string | null>(null);
  const janela = useRef<HTMLDialogElement>(null);

  function rodar(id: string, tarefa: () => Promise<{ ok: true } | { erro: string }>) {
    setOcupado(id);
    setErros((e) => ({ ...e, [id]: "" }));
    iniciar(async () => {
      const r = await tarefa();
      if ("erro" in r) setErros((e) => ({ ...e, [id]: r.erro }));
      setOtimista((o) => {
        const resto = { ...o };
        delete resto[id];
        return resto;
      });
      setOcupado(null);
    });
  }

  function escolher(lead: Lead, status: StatusLead) {
    if (status === lead.status) return;
    if (status === "cliente") {
      setVenda(lead);
      setValor(lead.valor_mensal ? formatarDinheiro(Number(lead.valor_mensal)) : "");
      setErroVenda(null);
      janela.current?.showModal();
      return;
    }
    setOtimista((o) => ({ ...o, [lead.id]: status }));
    rodar(lead.id, () => mudarStatus(lead.id, status));
  }

  function confirmarVenda() {
    if (!venda) return;
    const lead = venda;
    setErroVenda(null);
    iniciar(async () => {
      const r = await mudarStatus(lead.id, "cliente", valor);
      if ("erro" in r) {
        setErroVenda(r.erro);
        return;
      }
      janela.current?.close();
    });
  }

  const vendaJaFoi = venda?.lp_lead_eventos.find(
    (e) => e.evento === "Purchase" && e.enviado_em,
  );

  const linha = (lead: Lead) => ({
    status: otimista[lead.id] ?? lead.status,
    trabalhando: pendente && ocupado === lead.id,
    erro: erros[lead.id] || null,
  });

  return (
    <>
      {/* Seis colunas não cabem no celular, e tabela que rola de lado esconde
          coluna. No celular vira cartão. */}
      <div className="hidden lg:block">
        <Tabela>
          <thead>
            <tr>
              <th className={thEstilo}>Lead</th>
              <th className={thEstilo}>WhatsApp</th>
              <th className={thEstilo}>Faturamento</th>
              <th className={thEstilo}>Situação</th>
              <th className={thEstilo}>Meta</th>
              <th className={thEstilo} />
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const l = linha(lead);
              return (
                <tr
                  key={lead.id}
                  className={`transition hover:bg-surface-1 ${
                    l.status === "descartado" ? "opacity-60" : ""
                  }`}
                >
                  <td className={tdEstilo}>
                    <Pessoa lead={lead} agora={agora} />
                  </td>
                  <td className={`${tdEstilo} whitespace-nowrap font-mono text-[13px] text-muted`}>
                    {formatarTelefone(lead.whatsapp)}
                  </td>
                  <td className={`${tdEstilo} whitespace-nowrap text-muted`}>
                    {lead.faturamento.replace("/mês", "")}
                  </td>
                  <td className={tdEstilo}>
                    <Situacao
                      lead={lead}
                      status={l.status}
                      trabalhando={l.trabalhando}
                      onChange={(s) => escolher(lead, s)}
                    />
                    {l.erro ? (
                      <p role="alert" className="mt-1 text-xs text-danger">
                        {l.erro}
                      </p>
                    ) : null}
                  </td>
                  <td className={tdEstilo}>
                    <Eventos
                      lead={lead}
                      ocupado={pendente && ocupado === lead.id}
                      reenviar={(ev) => rodar(lead.id, () => reenviarEvento(lead.id, ev))}
                    />
                  </td>
                  <td className={`${tdEstilo} text-right`}>
                    <BotaoWhatsApp lead={lead} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      </div>

      <ul className="space-y-2 lg:hidden">
        {leads.map((lead) => {
          const l = linha(lead);
          return (
            <li
              key={lead.id}
              className={`space-y-3 rounded-lg border border-line bg-surface-1 p-3.5 ${
                l.status === "descartado" ? "opacity-60" : ""
              }`}
            >
              <Pessoa lead={lead} agora={agora} />
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
                <span className="font-mono">{formatarTelefone(lead.whatsapp)}</span>
                <span>{lead.faturamento.replace("/mês", "")}</span>
              </p>
              <Situacao
                lead={lead}
                status={l.status}
                trabalhando={l.trabalhando}
                onChange={(s) => escolher(lead, s)}
                grande
              />
              {l.erro ? (
                <p role="alert" className="text-xs text-danger">
                  {l.erro}
                </p>
              ) : null}
              <Eventos
                lead={lead}
                ocupado={pendente && ocupado === lead.id}
                reenviar={(ev) => rodar(lead.id, () => reenviarEvento(lead.id, ev))}
              />
              <BotaoWhatsApp lead={lead} grande />
            </li>
          );
        })}
      </ul>

      <Dialogo
        abrirPor={janela}
        aoFechar={() => setVenda(null)}
        // Fecha só quando a venda grava: com erro (valor vazio), a janela fica
        // aberta mostrando o erro junto do campo.
        fecharAoEnviar={false}
        titulo={venda ? `${venda.nome} virou cliente` : ""}
        descricao={
          vendaJaFoi
            ? `A venda já foi enviada à Meta antes (${reais(Number(vendaJaFoi.valor))}) e não vai de novo. O valor muda só aqui no hub.`
            : "O valor vai para a Meta como uma venda (Purchase). Depois de enviado, lá não tem como desfazer."
        }
      >
        {venda ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmarVenda();
            }}
          >
            <Campo
              rotulo="Valor mensal do contrato (R$)"
              obrigatorio
              erro={erroVenda ?? undefined}
            >
              <Entrada
                name="valor"
                inputMode="decimal"
                autoComplete="off"
                placeholder="2.500,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                invalido={Boolean(erroVenda)}
                autoFocus
              />
            </Campo>
            <AcoesDialogo>
              <Botao variante="secundario" onClick={() => janela.current?.close()}>
                Cancelar
              </Botao>
              <Botao type="submit" disabled={pendente}>
                {pendente ? <Rodinha /> : null}
                {pendente ? "Salvando…" : "Confirmar venda"}
              </Botao>
            </AcoesDialogo>
          </form>
        ) : null}
      </Dialogo>
    </>
  );
}

function Pessoa({ lead, agora }: { lead: Lead; agora: number }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold">{lead.nome}</p>
      {lead.status === "novo" ? (
        <p
          className={`text-[11.5px] ${
            esperaDemais(lead, agora) ? "font-semibold text-warn" : "text-dim"
          }`}
        >
          esperando {haQuanto(lead.created_at, agora)}
        </p>
      ) : (
        <p className="text-[11.5px] tabular text-dim">
          chegou {dataEHora(lead.created_at)}
        </p>
      )}
    </div>
  );
}

function Situacao({
  lead,
  status,
  trabalhando,
  onChange,
  grande,
}: {
  lead: Lead;
  status: StatusLead;
  trabalhando: boolean;
  onChange: (s: StatusLead) => void;
  grande?: boolean;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <span aria-hidden className={`h-2 w-2 flex-none rounded-full ${PONTO[status]}`} />
      <span className="sr-only">Situação de {lead.nome}</span>
      <select
        value={status}
        disabled={trabalhando}
        onChange={(e) => onChange(e.target.value as StatusLead)}
        className={`cursor-pointer rounded-md border border-line-strong bg-surface-2 px-2.5 font-semibold outline-none transition focus:border-brand disabled:opacity-50 ${
          TEXTO[status]
        } ${grande ? "min-h-11 text-base" : "min-h-[30px] text-xs"}`}
      >
        {STATUS_LEAD.map((s) => (
          <option key={s} value={s} className="bg-surface-2 text-foreground">
            {ROTULO_STATUS[s]}
          </option>
        ))}
      </select>
      {trabalhando ? <Rodinha className="text-muted" /> : null}
    </label>
  );
}

function Eventos({
  lead,
  ocupado,
  reenviar,
}: {
  lead: Lead;
  ocupado: boolean;
  reenviar: (evento: EventoMeta) => void;
}) {
  const itens = ORDEM_EVENTOS.flatMap((ev) => {
    const linha = lead.lp_lead_eventos.find((e) => e.evento === ev);
    // Sem linha de Lead é lead que chegou antes de a LP avisar o hub, ou cuja
    // chamada não chegou: aparece como não enviado, para mandar daqui.
    if (!linha && ev !== "Lead") return [];
    return [{ evento: ev, linha }];
  });

  return (
    <div className="flex flex-wrap gap-1.5">
      {itens.map(({ evento, linha }) => {
        const rotulo =
          evento === "Purchase" && linha?.valor
            ? `${ROTULO_EVENTO[evento]} ${reais(Number(linha.valor))}`
            : ROTULO_EVENTO[evento];

        return linha?.enviado_em ? (
          <Selo key={evento} tom="pronto">
            {rotulo}
          </Selo>
        ) : (
          <button
            key={evento}
            type="button"
            disabled={ocupado}
            onClick={() => reenviar(evento)}
            title={linha?.erro ?? "Ainda não foi enviado à Meta."}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn transition hover:bg-warn/25 disabled:opacity-50"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
            {/* "Lead" é masculino; "Proposta" e "Venda", femininos. */}
            {rotulo} {evento === "Lead" ? "não enviado" : "não enviada"} · Reenviar
          </button>
        );
      })}
    </div>
  );
}

function BotaoWhatsApp({ lead, grande }: { lead: Lead; grande?: boolean }) {
  return (
    <a
      href={linkWhatsApp(lead)}
      target="_blank"
      rel="noreferrer"
      className={`${botaoEstilo("secundario", grande ? "md" : "sm")} ${grande ? "w-full" : ""}`}
    >
      <Icone nome="conversa" className="h-3.5 w-3.5" />
      Chamar no WhatsApp
    </a>
  );
}

